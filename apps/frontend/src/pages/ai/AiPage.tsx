import { Alert, App, Button, Card, Col, Descriptions, List, Progress, Row, Space, Statistic, Switch, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useMarketStore } from '../../entities/market/model/store';
import { TradingChart, type ChartLevel } from '../../widgets/trading-chart/TradingChart';
import { OpenTrades } from '../../widgets/open-trades/OpenTrades';
import { AI } from '../../entities/strategy/model/types';
import { MarketHeader } from '../../widgets/market-header/MarketHeader';
import { useAiClosePosition, useAiToggle, useAiStatus, type AiAnalysis, type AiStatus } from '../../entities/ai/api/ai';
import { formatTime } from '../../shared/lib/time';
import { ApiError } from '../../shared/api/httpClient';
import { translateError, useT } from '../../shared/i18n';

const fmt = (value: number | null | undefined) => (value === null || value === undefined ? '—' : value.toFixed(2));
const fmtInt = (value: number) => value.toLocaleString('ru-RU');
const DECISION_COLOR = { BUY: 'success', SELL: 'error', SKIP: 'default' } as const;

function Limit({ label, remaining, limit }: { label: string; remaining: number | null; limit: number | null }) {
  if (remaining === null || limit === null || limit === 0) return null;
  return (
    <div>
      <Typography.Text type="secondary">
        {label}: {fmtInt(remaining)} / {fmtInt(limit)}
      </Typography.Text>
      <Progress percent={Math.round((remaining / limit) * 100)} size="small" showInfo={false} />
    </div>
  );
}

function AnalysisBlock({ item }: { item: AiAnalysis }) {
  const t = useT();
  const timezone = useMarketStore((s) => s.timezone);
  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <Space wrap>
        <Tag color={DECISION_COLOR[item.decision]}>{item.decision === 'SKIP' ? t('ai.skip') : item.decision}</Tag>
        <Typography.Text type="secondary">{formatTime(item.time, timezone)}</Typography.Text>
        <Typography.Text type="secondary">
          {fmtInt(item.inputTokens)} + {fmtInt(item.outputTokens)} {t('ai.tokens')}{item.costUsd !== null ? ` · $${item.costUsd.toFixed(4)}` : ''}
        </Typography.Text>
      </Space>
      {item.analysis && <Typography.Paragraph style={{ marginBottom: 0 }}>{item.analysis}</Typography.Paragraph>}
      {item.decision !== 'SKIP' && (
        <Space wrap size={16}>
          <span>{t('ai.entry')}: <b>{fmt(item.entry)}</b></span>
          <span>Stop Loss: <b>{fmt(item.stopLoss)}</b></span>
          <span>{t('ai.takeProfit')}: <b>{fmt(item.takeProfit)}</b></span>
        </Space>
      )}
      {item.rejected && <Alert type="warning" showIcon title={`${t('ai.notTraded')}: ${item.rejected}`} />}
    </Space>
  );
}

/** Where the price is between Stop Loss and target, and how far it is to each. */
function TradeProgress({ pos, price }: { pos: NonNullable<AiStatus['position']>; price: number | null }) {
  const t = useT();
  if (price === null) return null;
  const sign = pos.direction === 'BUY' ? 1 : -1;
  const toTp = sign * (pos.takeProfit - price);
  const toSl = sign * (price - pos.stopLoss);
  const reward = sign * (pos.takeProfit - pos.entryPrice);
  const risk = sign * (pos.entryPrice - pos.initialStopLoss);
  const progress = Math.max(0, Math.min(100, (sign * (price - pos.entryPrice) / reward) * 100));
  // The stop may sit above entry after breakeven: then the remaining risk is a locked profit, not a loss.
  const stopLocked = sign * (pos.stopLoss - pos.entryPrice) >= 0;
  const lossPercent = stopLocked ? 0 : Math.max(0, Math.min(100, (sign * (pos.entryPrice - price) / risk) * 100));
  return (
    <Space orientation="vertical" size={6} style={{ width: '100%' }}>
      <div>
        <Typography.Text type="secondary">{t('ai.progressTp')}: {progress.toFixed(0)}% · {Math.max(0, toTp).toFixed(2)} {t('ai.points')}</Typography.Text>
        <Progress percent={Math.round(progress)} size="small" strokeColor="#3fb950" showInfo={false} />
      </div>
      <div>
        <Typography.Text type="secondary">
          {stopLocked ? t('ai.progressLocked') : t('ai.progressSl')}: {stopLocked ? `+${sign * (pos.stopLoss - pos.entryPrice) >= 0 ? (sign * (pos.stopLoss - pos.entryPrice)).toFixed(2) : '0.00'} ${t('ai.points')}` : `${lossPercent.toFixed(0)}%`} · {t('ai.toStop')} {Math.max(0, toSl).toFixed(2)} {t('ai.points')}
        </Typography.Text>
        <Progress percent={stopLocked ? 100 : Math.round(lossPercent)} size="small" strokeColor={stopLocked ? '#3fb950' : '#f85149'} showInfo={false} />
      </div>
    </Space>
  );
}

function PositionOverlay() {
  const t = useT();
  const { message } = App.useApp();
  const close = useAiClosePosition();
  const handle = () => close.mutateAsync().catch(() => message.error(t('ai.toggleFailed')));
  return (
    <Button type="primary" size="small" danger loading={close.isPending} onClick={handle}>
      {t('ai.closePosition')}
    </Button>
  );
}

/** «ИИ-стратегия» (super admin only): Claude finds entry/stop/target; code opens, protects and trails the position. */
export function AiPage() {
  const t = useT();
  const { message } = App.useApp();
  const { data: status } = useAiStatus();
  const toggle = useAiToggle();
  const candles = useMarketStore((s) => s.candles);
  const timezone = useMarketStore((s) => s.timezone);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggle.mutateAsync(enabled);
    } catch (err) {
      message.error(err instanceof ApiError ? translateError(t, err.code, err.status) : t('ai.toggleFailed'));
    }
  };

  const waitSec = status.nextAnalysisAt ? Math.max(0, Math.ceil((status.nextAnalysisAt - now) / 1000)) : null;
  const stateText = !status.enabled
    ? t('ai.stateOff')
    : status.position
      ? t('ai.stateInTrade')
      : status.analyzing
        ? t('ai.stateAnalyzing')
        : t('ai.stateNext').replace('{n}', String(waitSec ?? 0));
  const rate = status.rateLimit;
  const pos = status.position;

  // Live position when there is one; otherwise the model's latest proposal (dashed) so the idea is visible on the chart.
  const idea = !pos && status.last && status.last.decision !== 'SKIP' && !status.last.rejected ? status.last : null;
  const levels: ChartLevel[] = pos
    ? [
        { price: pos.entryPrice, color: '#3fb950', title: t('chart.entry'), lineStyle: 0 },
        { price: pos.stopLoss, color: '#f85149', title: 'STOP LOSS', lineStyle: 0 },
        { price: pos.stage >= 1 ? null : pos.initialStopLoss === pos.stopLoss ? null : pos.initialStopLoss, color: '#e0a800', title: t('ai.initialStop') },
        { price: pos.takeProfit, color: '#00e676', title: 'TP', lineStyle: 0 },
      ]
    : [
        { price: idea?.entry ?? null, color: '#3fb950', title: t('chart.entry') },
        { price: idea?.stopLoss ?? null, color: '#f85149', title: 'STOP LOSS' },
        { price: idea?.takeProfit ?? null, color: '#00e676', title: 'TP' },
      ];

  return (
    <Space orientation="vertical" size="large" className="page">
      <Card
        title={
          <Space wrap>
            {t('ai.title')}
            <Tag>{status.model}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Typography.Text>{status.enabled ? t('ai.on') : t('ai.off')}</Typography.Text>
            <Switch checked={status.enabled} loading={toggle.isPending} disabled={!status.configured} onChange={handleToggle} />
          </Space>
        }
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          {!status.configured && <Alert type="error" showIcon title={t('ai.noKey')} />}
          <Typography.Text type="secondary">{t('ai.description')}</Typography.Text>
          <Typography.Text strong>{stateText}</Typography.Text>
          {status.lastError && <Alert type="warning" showIcon title={status.lastError} />}
        </Space>
      </Card>

      <MarketHeader />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <TradingChart candles={candles} levels={levels} overlay={pos ? <PositionOverlay /> : undefined} />
        </Col>
        <Col xs={24} xl={7}>
          <Card title={t('ai.signalTitle')} loading={false}>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Tag color={pos ? (pos.direction === 'BUY' ? 'success' : 'error') : status.enabled ? 'processing' : 'default'} style={{ fontSize: 16, padding: '4px 12px' }}>
                {pos ? pos.direction : status.enabled ? (status.analyzing ? t('ai.analyzingShort') : t('ai.waitingShort')) : t('ai.off')}
              </Tag>
              {pos && <TradeProgress pos={pos} price={status.price} />}
              {pos ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('ai.entry')}>{fmt(pos.entryPrice)}</Descriptions.Item>
                  <Descriptions.Item label="Stop Loss">
                    {fmt(pos.stopLoss)} {pos.stage >= 1 && <Tag color="processing">{t('ai.breakeven')}</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('ai.takeProfit')}>{fmt(pos.takeProfit)}</Descriptions.Item>
                  <Descriptions.Item label={t('ai.price')}>{fmt(status.price)}</Descriptions.Item>
                  <Descriptions.Item label="PnL">
                    <Typography.Text type={pos.pnlPoints >= 0 ? 'success' : 'danger'}>{pos.pnlPoints >= 0 ? '+' : ''}{pos.pnlPoints.toFixed(2)}</Typography.Text>
                  </Descriptions.Item>
                </Descriptions>
              ) : idea ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('ai.entry')}>{fmt(idea.entry)}</Descriptions.Item>
                  <Descriptions.Item label="Stop Loss">{fmt(idea.stopLoss)}</Descriptions.Item>
                  <Descriptions.Item label={t('ai.takeProfit')}>{fmt(idea.takeProfit)}</Descriptions.Item>
                </Descriptions>
              ) : (
                <Typography.Text type="secondary">{t('ai.noPosition')}</Typography.Text>
              )}
              {status.last?.analysis && (
                <div>
                  <Typography.Text type="secondary">{t('ai.lastAnalysis')} · {formatTime(status.last.time, timezone)}</Typography.Text>
                  <Typography.Paragraph style={{ marginTop: 4, marginBottom: 0 }}>{status.last.analysis}</Typography.Paragraph>
                </div>
              )}
              {status.last?.rejected && <Alert type="warning" showIcon title={`${t('ai.notTraded')}: ${status.last.rejected}`} />}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={24}>
          <Card title={t('ai.usage')}>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col xs={12} md={6}><Statistic title={t('ai.requests')} value={status.usage.requests} /></Col>
                <Col xs={12} md={6}><Statistic title={t('ai.tokensIn')} value={status.usage.inputTokens} /></Col>
                <Col xs={12} md={6}><Statistic title={t('ai.tokensOut')} value={status.usage.outputTokens} /></Col>
                <Col xs={12} md={6}>
                  <Statistic title={t('ai.cost')} value={status.usage.priceKnown ? status.usage.costUsd : '—'} prefix={status.usage.priceKnown ? '$' : undefined} precision={4} />
                </Col>
              </Row>
              {rate && (
                <>
                  <Limit label={t('ai.limitRequests')} remaining={rate.requestsRemaining} limit={rate.requestsLimit} />
                  <Limit label={t('ai.limitIn')} remaining={rate.inputTokensRemaining} limit={rate.inputTokensLimit} />
                  <Limit label={t('ai.limitOut')} remaining={rate.outputTokensRemaining} limit={rate.outputTokensLimit} />
                </>
              )}
              {status.usage.priceKnown && status.usage.requests > 0 && (
                <Typography.Text type="secondary">
                  {t('ai.costPerRequest')}: ${(status.usage.costUsd / status.usage.requests).toFixed(4)} · {t('ai.costPerHour')}: ~${((status.usage.costUsd / status.usage.requests) * (3600 / status.intervalSec)).toFixed(2)} · ${status.usage.inputPerMTok} / ${status.usage.outputPerMTok} {t('ai.perMTok')}
                </Typography.Text>
              )}
              <Typography.Text type="secondary">{t('ai.balanceNote')}</Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <OpenTrades strategy={AI} />

      {status.history.length > 0 && (
        <Card title={t('ai.history')}>
          <List dataSource={status.history} renderItem={(item) => <List.Item key={item.id}><AnalysisBlock item={item} /></List.Item>} />
        </Card>
      )}
    </Space>
  );
}
