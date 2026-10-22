import { prisma } from './prisma';

export interface AiAnalysisRecord {
  id: string;
  time: number;
  decision: 'BUY' | 'SELL' | 'SKIP';
  analysis: string;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  rejected: string | null;
  signalId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

const num = (value: { toString(): string } | null) => (value === null ? null : Number(value));

function toRecord(row: Awaited<ReturnType<typeof prisma.aiAnalysis.findFirstOrThrow>>): AiAnalysisRecord {
  return {
    id: row.id,
    time: row.createdAt.getTime(),
    decision: row.decision === 'BUY' || row.decision === 'SELL' ? row.decision : 'SKIP',
    analysis: row.analysis,
    entry: num(row.entry),
    stopLoss: num(row.stopLoss),
    takeProfit: num(row.takeProfit),
    rejected: row.rejected,
    signalId: row.signalId,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    costUsd: num(row.costUsd),
  };
}

export async function saveAiAnalysis(params: Omit<AiAnalysisRecord, 'id' | 'time'> & { symbol: string; model: string; price: number | null }): Promise<AiAnalysisRecord> {
  const { symbol, model, price, ...rest } = params;
  const row = await prisma.aiAnalysis.create({
    data: { symbol, model, price, decision: rest.decision, analysis: rest.analysis, entry: rest.entry, stopLoss: rest.stopLoss, takeProfit: rest.takeProfit, rejected: rest.rejected, signalId: rest.signalId, inputTokens: rest.inputTokens, outputTokens: rest.outputTokens, costUsd: rest.costUsd },
  });
  return toRecord(row);
}

export async function listAiAnalyses(limit: number, before?: number): Promise<AiAnalysisRecord[]> {
  const rows = await prisma.aiAnalysis.findMany({
    where: before ? { createdAt: { lt: new Date(before) } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(toRecord);
}

/** All-time totals, so the usage counters survive a restart. */
export async function aiUsageTotals() {
  const sum = await prisma.aiAnalysis.aggregate({ _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, costUsd: true }, _min: { createdAt: true } });
  return {
    requests: sum._count._all,
    inputTokens: sum._sum.inputTokens ?? 0,
    outputTokens: sum._sum.outputTokens ?? 0,
    costUsd: Number(sum._sum.costUsd ?? 0),
    since: sum._min.createdAt?.getTime() ?? Date.now(),
  };
}

const AI_ENABLED_KEY = 'ai.enabled';

/** The super admin's on/off choice survives restarts and deploys; the very first start is off. */
export async function readAiEnabled(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: AI_ENABLED_KEY } });
  return row?.value === 'true';
}

export async function writeAiEnabled(enabled: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: AI_ENABLED_KEY },
    update: { value: String(enabled) },
    create: { key: AI_ENABLED_KEY, value: String(enabled) },
  });
}
