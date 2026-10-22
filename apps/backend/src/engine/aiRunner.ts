import type { Candle } from '@troyka/strategy-engine';
import { askClaude, costUsd, modelPrice, type ClaudeUsage, type RateLimitInfo } from '../ai/claudeClient';
import { atr, ema, round, rsi } from '../ai/indicators';
import { listActiveSuperAdminIds } from '../db/accountRepository';
import { aiUsageTotals, listAiAnalyses, saveAiAnalysis, type AiAnalysisRecord } from '../db/aiRepository';
import { createTradingSession } from '../db/sessionRepository';
import {
  buildSignalId,
  closeTradeByStopLoss,
  closeTradeByTakeProfit,
  closeTradeManually,
  countOpenTradesForSignal,
  createTradesForSignal,
  moveStopLoss,
  type TradeDTO,
} from '../db/tradeRepository';
import { env } from '../env';
import type { EngineRunnerConfig } from './runner';

/** Guard rails around whatever the model answers (gold: 1 point = $1). */
const MIN_STOP_POINTS = 2;
const MAX_STOP_POINTS = 15;
const MIN_REWARD_RISK = 1;
/** The model answers in seconds: the live price may have moved away from the entry it saw. */
const MAX_ENTRY_DRIFT_POINTS = 2;
/** Price must be at least this fresh (ms) to analyse or enter: stops us on closed markets. */
const MAX_PRICE_AGE_MS = 60_000;
/** At +1R the stop goes to breakeven, afterwards it trails 1R behind the best price. */
const BREAKEVEN_AT_R = 1;
const HISTORY_LIMIT = 20;

const SYSTEM_PROMPT = `You are a disciplined intraday scalping analyst for spot gold (XAUUSD). 1 point = $1.
You get recent 5-minute candles, hourly candles and indicators. First analyse the market (trend, momentum, levels, volatility), then decide.
Only take a trade when there is a clear edge; otherwise answer SKIP. Skipping is a good answer.
Reply with ONE JSON object and nothing else:
{"decision":"BUY"|"SELL"|"SKIP","analysis":"2-4 sentences in Russian","entry":number,"stopLoss":number,"takeProfit":number}
Rules: for BUY stopLoss < entry < takeProfit; for SELL takeProfit < entry < stopLoss. Stop distance ${MIN_STOP_POINTS}-${MAX_STOP_POINTS} points,
reward/risk at least ${MIN_REWARD_RISK}. Put the stop behind a real level, not an arbitrary number. entry is the current price (or very close). For SKIP omit entry/stopLoss/takeProfit.`;

export type AiAnalysis = AiAnalysisRecord;

export interface AiPosition {
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  initialStopLoss: number;
  stopLoss: number;
  takeProfit: number;
  risk: number;
  /** 0 = initial stop, 1 = breakeven reached (stop at or above entry). */
  stage: number;
  /** Best price seen in the trade's favour — the trailing stop hangs off it. */
  bestPrice: number;
  openedAt: number;
}

export interface AiStatus {
  configured: boolean;
  enabled: boolean;
  analyzing: boolean;
  model: string;
  intervalSec: number;
  nextAnalysisAt: number | null;
  price: number | null;
  position: (AiPosition & { pnlPoints: number }) | null;
  last: AiAnalysis | null;
  history: AiAnalysis[];
  lastError: string | null;
  usage: { requests: number; inputTokens: number; outputTokens: number; since: number; costUsd: number; priceKnown: boolean; inputPerMTok: number | null; outputPerMTok: number | null };
  rateLimit: RateLimitInfo | null;
}

interface MarketSource {
  m5: () => Candle[];
  h1: () => Candle[];
}

const fmt = (c: Candle) => `${new Date(c.time).toISOString().slice(5, 16)} O${c.open.toFixed(2)} H${c.high.toFixed(2)} L${c.low.toFixed(2)} C${c.close.toFixed(2)}`;

/** Pulls a JSON object out of the model's text, tolerating a ```json fence or stray prose. */
function parseReply(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const asNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * The AI strategy: Claude analyses the market and proposes entry, stop and target; plain code
 * validates the answer, opens the position for super admins and manages it (automatic breakeven,
 * trailing stop, stop/target exits). Off by default and in-memory only: a restart turns it off.
 */
export class AiRunner {
  private enabled = false;
  private analyzing = false;
  private timer: NodeJS.Timeout | null = null;
  private nextAnalysisAt: number | null = null;
  private price: { value: number; time: number } | null = null;
  private position: AiPosition | null = null;
  private openSignalId: string | null = null;
  private history: AiAnalysis[] = [];
  private analysisCounter = 0;
  private lastError: string | null = null;
  private usage = { requests: 0, inputTokens: 0, outputTokens: 0, since: Date.now(), costUsd: 0 };
  private rateLimit: RateLimitInfo | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly config: EngineRunnerConfig,
    private readonly market: MarketSource,
    private readonly onChange: () => void,
  ) {}

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  hydrateFromOpenTrade(trade: TradeDTO) {
    const initial = trade.initialStopLoss ?? trade.stopLoss;
    const sign = trade.direction === 'BUY' ? 1 : -1;
    const risk = Math.abs(trade.entryPrice - initial);
    if (trade.takeProfit1 === null || risk === 0) {
      console.error(`[ai] Open trade ${trade.id} has no target — not restored`);
      return;
    }
    this.openSignalId = trade.signalId;
    this.position = {
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      initialStopLoss: initial,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit1,
      risk,
      stage: trade.stage,
      // The trailing stop sits `risk` behind the best price once breakeven is reached.
      bestPrice: trade.stage >= 1 ? trade.stopLoss + sign * risk : trade.entryPrice,
      openedAt: trade.confirmationTime,
    };
  }

  /** Restores the history and usage counters from Postgres, so a restart doesn't reset them. */
  async loadFromDb() {
    this.history = await listAiAnalyses(HISTORY_LIMIT);
    this.usage = await aiUsageTotals();
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return;
    if (enabled && !env.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    this.enabled = enabled;
    if (enabled) {
      this.lastError = null;
      this.timer = setInterval(() => void this.analyzeIfDue(), 5_000);
      this.nextAnalysisAt = Date.now();
      void this.analyzeIfDue();
    } else {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.nextAnalysisAt = null;
    }
    this.onChange();
  }

  getStatus(): AiStatus {
    const price = this.price?.value ?? null;
    const position = this.position;
    return {
      configured: Boolean(env.anthropicApiKey),
      enabled: this.enabled,
      analyzing: this.analyzing,
      model: env.aiModel,
      intervalSec: env.aiIntervalSec,
      nextAnalysisAt: this.nextAnalysisAt,
      price,
      position: position && price !== null ? { ...position, pnlPoints: (position.direction === 'BUY' ? 1 : -1) * (price - position.entryPrice) } : null,
      last: this.history[0] ?? null,
      history: this.history,
      lastError: this.lastError,
      usage: { ...this.usage, priceKnown: modelPrice() !== null, inputPerMTok: modelPrice()?.inputPerMTok ?? null, outputPerMTok: modelPrice()?.outputPerMTok ?? null },
      rateLimit: this.rateLimit,
    };
  }

  /** Called for every price tick (also while off — an open position must stay protected). */
  tick(price: number, time: number): Promise<void> {
    this.price = { value: price, time };
    if (!this.position) return Promise.resolve();
    return this.enqueue(() => this.managePosition(price, time)).catch((err) => console.error('[ai] Tick processing failed:', err));
  }

  private async managePosition(price: number, time: number) {
    const pos = this.position;
    const signalId = this.openSignalId;
    if (!pos || !signalId) return;
    const sign = pos.direction === 'BUY' ? 1 : -1;
    const pnl = sign * (price - pos.entryPrice);

    if (sign * (price - pos.takeProfit) >= 0) {
      await closeTradeByTakeProfit(signalId, price, time, pnl);
      this.releasePosition();
      return;
    }
    if (sign * (price - pos.stopLoss) <= 0) {
      await closeTradeByStopLoss(signalId, price, time, pnl);
      this.releasePosition();
      return;
    }

    if (sign * (price - pos.bestPrice) > 0) pos.bestPrice = price;
    const bestProfit = sign * (pos.bestPrice - pos.entryPrice);
    if (bestProfit >= BREAKEVEN_AT_R * pos.risk) {
      const nextStop = pos.bestPrice - sign * pos.risk;
      if (sign * (nextStop - pos.stopLoss) > 0.005) {
        pos.stopLoss = nextStop;
        pos.stage = 1;
        await moveStopLoss(signalId, nextStop, 1);
        this.onChange();
      }
    }
  }

  private releasePosition() {
    this.position = null;
    this.openSignalId = null;
    this.nextAnalysisAt = this.enabled ? Date.now() + env.aiIntervalSec * 1000 : null;
    this.onChange();
  }

  /** «Закрыть позицию» for one account; the strategy is freed once nobody holds the position. */
  closePositionFor(accountId: string, currentPrice: number, currentTime: number) {
    return this.enqueue(async () => {
      const pos = this.position;
      const signalId = this.openSignalId;
      if (!pos || !signalId) return null;
      const pnlPoints = (pos.direction === 'BUY' ? 1 : -1) * (currentPrice - pos.entryPrice);
      if (!(await closeTradeManually(signalId, accountId, currentPrice, currentTime, pnlPoints))) return null;
      if ((await countOpenTradesForSignal(signalId)) === 0) this.releasePosition();
      return { exitPrice: currentPrice, exitTime: currentTime, pnlPoints };
    });
  }

  private async analyzeIfDue() {
    if (!this.enabled || this.analyzing || this.position) return;
    if (this.nextAnalysisAt !== null && Date.now() < this.nextAnalysisAt) return;
    this.analyzing = true;
    this.onChange();
    try {
      await this.analyze();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      console.error('[ai] Analysis failed:', this.lastError);
    } finally {
      this.analyzing = false;
      this.nextAnalysisAt = this.enabled ? Date.now() + env.aiIntervalSec * 1000 : null;
      this.onChange();
    }
  }

  private buildPrompt(price: number): string {
    const m5 = this.market.m5();
    const h1 = this.market.h1();
    const closes5 = m5.map((c) => c.close);
    const closes1 = h1.map((c) => c.close);
    const recent = m5.slice(-48);
    const day = m5.slice(-288);
    const indicators = {
      price: round(price),
      m5: { ema20: round(ema(closes5, 20)), ema50: round(ema(closes5, 50)), rsi14: round(rsi(closes5), 1), atr14: round(atr(m5)) },
      h1: { ema20: round(ema(closes1, 20)), ema50: round(ema(closes1, 50)), rsi14: round(rsi(closes1), 1), atr14: round(atr(h1)) },
      last24hHigh: day.length ? round(Math.max(...day.map((c) => c.high))) : null,
      last24hLow: day.length ? round(Math.min(...day.map((c) => c.low))) : null,
    };
    return [
      `Now (UTC): ${new Date().toISOString()}`,
      `Indicators: ${JSON.stringify(indicators)}`,
      `Last 24 hourly candles:\n${h1.slice(-24).map(fmt).join('\n')}`,
      `Last ${recent.length} five-minute candles (the last one is still forming):\n${recent.map(fmt).join('\n')}`,
    ].join('\n\n');
  }

  /** Keeps the answer in memory right away and in Postgres (a failed write is logged, never blocks trading). */
  private async record(entry: Omit<AiAnalysis, 'id' | 'time'>) {
    let saved: AiAnalysis;
    try {
      saved = await saveAiAnalysis({ ...entry, symbol: this.config.symbol, model: env.aiModel, price: this.price?.value ?? null });
    } catch (err) {
      console.error('[ai] Failed to save the analysis:', err);
      saved = { ...entry, id: `mem-${Date.now()}`, time: Date.now() };
    }
    this.history = [saved, ...this.history].slice(0, HISTORY_LIMIT);
  }

  private async analyze() {
    const snapshot = this.price;
    if (!snapshot || Date.now() - snapshot.time > MAX_PRICE_AGE_MS) {
      this.lastError = 'Нет свежей цены (рынок закрыт?) — анализ пропущен';
      return;
    }
    if (this.market.m5().length < 60) {
      this.lastError = 'Недостаточно свечей для анализа';
      return;
    }

    const reply = await askClaude(SYSTEM_PROMPT, this.buildPrompt(snapshot.value));
    this.lastError = null;
    this.addUsage(reply.usage, reply.rateLimit);

    const parsed = parseReply(reply.text);
    const decision = parsed?.decision === 'BUY' || parsed?.decision === 'SELL' ? parsed.decision : 'SKIP';
    const analysis = typeof parsed?.analysis === 'string' ? parsed.analysis.slice(0, 1200) : parsed ? '' : 'Ответ модели не удалось разобрать';
    const base = { signalId: null as string | null, analysis, inputTokens: reply.usage.inputTokens, outputTokens: reply.usage.outputTokens, costUsd: costUsd(reply.usage) };
    if (!parsed || decision === 'SKIP') {
      await this.record({ ...base, decision: 'SKIP', entry: null, stopLoss: null, takeProfit: null, rejected: parsed ? null : 'Ответ модели не удалось разобрать' });
      return;
    }

    const entry = asNumber(parsed.entry);
    const stopLoss = asNumber(parsed.stopLoss);
    const takeProfit = asNumber(parsed.takeProfit);
    const fields = { entry, stopLoss, takeProfit };
    const reject = (reason: string) => this.record({ ...base, decision, ...fields, rejected: reason });
    if (entry === null || stopLoss === null || takeProfit === null) return await reject('В ответе нет входа, стопа или цели');

    // The position is opened at the live price, so every check is against it, not against the model's `entry`.
    const live = this.price?.value ?? snapshot.value;
    const sign = decision === 'BUY' ? 1 : -1;
    const risk = sign * (live - stopLoss);
    const reward = sign * (takeProfit - live);
    if (Math.abs(entry - live) > MAX_ENTRY_DRIFT_POINTS) return await reject(`Цена ушла от входа (${entry} → ${live.toFixed(2)})`);
    if (risk <= 0 || reward <= 0) return await reject('Стоп или цель с неверной стороны от цены');
    if (risk < MIN_STOP_POINTS || risk > MAX_STOP_POINTS) return await reject(`Стоп ${risk.toFixed(2)} п. вне допустимых ${MIN_STOP_POINTS}–${MAX_STOP_POINTS}`);
    if (reward / risk < MIN_REWARD_RISK) return await reject(`Прибыль/риск ${(reward / risk).toFixed(2)} ниже ${MIN_REWARD_RISK}`);

    const opened = await this.enqueue(() => this.openPosition(decision, live, stopLoss, takeProfit));
    await this.record({ ...base, signalId: opened, decision, ...fields, rejected: opened ? null : 'Позиция не открыта (нет активных супер-админов)' });
  }

  private addUsage(usage: ClaudeUsage, rateLimit: RateLimitInfo) {
    this.usage.requests += 1;
    this.usage.inputTokens += usage.inputTokens;
    this.usage.outputTokens += usage.outputTokens;
    this.usage.costUsd += costUsd(usage) ?? 0;
    this.rateLimit = rateLimit;
  }

  private async openPosition(direction: 'BUY' | 'SELL', entry: number, stopLoss: number, takeProfit: number): Promise<string | null> {
    if (this.position) return null;
    const accountIds = await listActiveSuperAdminIds();
    if (accountIds.length === 0) return null;

    const now = Date.now();
    const risk = Math.abs(entry - stopLoss);
    const m5 = this.market.m5().slice(-36);
    const high = Math.max(...m5.map((c) => c.high));
    const low = Math.min(...m5.map((c) => c.low));
    // TradingSession/Trade carry the scalping range columns; for AI they hold the last 3h as context.
    const range = { rangeStart: now - 3 * 3600_000, rangeEnd: now, highDemand: high, lowDemand: low, rangePoints: high - low, upperLevel: takeProfit, lowerLevel: stopLoss };
    const session = await createTradingSession(this.config.symbol, this.config.strategy, range);
    const created = await createTradesForSignal(
      {
        userId: this.config.userId,
        symbol: this.config.symbol,
        strategy: this.config.strategy,
        timeframe: this.config.timeframe,
        sessionId: session.id,
        direction,
        ...range,
        movementStartTime: now,
        movementStartPrice: entry,
        confirmationTime: now,
        entryPrice: entry,
        stopLoss,
        // dailySpeed/breakevenStep hold the risk (1R); the target is stored as TP1.
        longTerm: { dailySpeed: risk, breakevenStep: risk, takeProfit1: takeProfit, takeProfit2: takeProfit, takeProfit3: takeProfit, stage: 0, targetsHit: 0 },
      },
      accountIds,
    );
    if (created === 0) return null;

    this.openSignalId = buildSignalId(this.config.strategy, this.config.symbol, now, direction);
    this.position = { direction, entryPrice: entry, initialStopLoss: stopLoss, stopLoss, takeProfit, risk, stage: 0, bestPrice: entry, openedAt: now };
    return this.openSignalId;
  }
}
