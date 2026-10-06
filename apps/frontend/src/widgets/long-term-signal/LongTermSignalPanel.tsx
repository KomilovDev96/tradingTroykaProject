import { Alert, App, Button, Card, Descriptions, Progress, Space, Tag, Typography } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { useMeQuery } from '../../entities/session/api/session';
import { LONG_TERM } from '../../entities/strategy/model/types';
import { useOpenTradesQuery } from '../../entities/trade/api/queries';
import { ClosePositionButton } from '../../features/close-position/ui/ClosePositionButton';
import { useToggleAnalysis } from '../../features/toggle-analysis/model/useToggleAnalysis';
import { ApiError } from '../../shared/api/httpClient';
import { translateError, useT } from '../../shared/i18n';

function fmt(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : value.toFixed(2);
}

const SIGNAL_COLOR: Record<string, string> = { BUY: 'success', SELL: 'error', WAIT: 'default' };

/**
 * The H1 troika (shared by everyone) and this account's own long-term position with its
 * breakeven steps and take-profit targets — PDF sections 2, 4, 6 and 7.
 */
export function LongTermSignalPanel() {
  const t = useT();
  const { message } = App.useApp();
  const output = useMarketStore((s) => s.longTermOutput);
  const me = useMeQuery().data;
  const position = useOpenTradesQuery(LONG_TERM).data?.[0] ?? null;
  const toggleAnalysis = useToggleAnalysis();

  const paused = me?.analysisPaused ?? false;

  const handleToggle = async () => {
    try {
      await toggleAnalysis.mutateAsync(!paused);
      message.success(paused ? t('signal.resumedOk') : t('signal.pausedOk'));
    } catch (err) {
      message.error(err instanceof ApiError ? translateError(t, err.code, err.status) : t('signal.toggleFailed'));
    }
  };

  const currentPrice = output?.currentPrice ?? null;
  const pnl =
    position && currentPrice !== null ? (position.direction === 'BUY' ? currentPrice - position.entryPrice : position.entryPrice - currentPrice) : null;
  const sign = position?.direction === 'SELL' ? -1 : 1;
  const step = position?.breakevenStep ?? null;
  const risk = position ? Math.abs(position.entryPrice - (position.initialStopLoss ?? position.stopLoss)) : 0;
  const riskReward = position?.takeProfit3 != null && risk > 0 ? Math.abs(position.takeProfit3 - position.entryPrice) / risk : null;

  const signal = position ? position.direction : 'WAIT';
  const signalLabel = position ? position.direction : paused ? t('phase.PAUSED') : t(output?.phase === 'NO_SPEED' ? 'phase.NO_SPEED' : 'phase.WAITING');
  const reached = (target: number) => (position && position.targetsHit >= target ? <Tag color="success">{t('longTerm.reached')}</Tag> : null);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{t('longTerm.signalTitle')}</span>
        <Tag color={SIGNAL_COLOR[signal]} style={{ fontSize: 16, padding: '2px 12px', margin: 0 }}>
          {signalLabel}
        </Tag>
      </div>

      {paused && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={t('signal.pausedTitle')}
          description={position ? t('signal.pausedWithPosition') : t('signal.pausedIdle')}
        />
      )}

      {!position && output?.movementDirection && (
        <div style={{ marginBottom: 16 }}>
          <div>
            {t('longTerm.progress', {
              n: output.movementCandles,
              direction: output.movementDirection === 'UP' ? t('signal.directionUp') : t('signal.directionDown'),
            })}
          </div>
          <Progress percent={Math.round((output.movementCandles / 3) * 100)} steps={3} strokeColor={output.movementDirection === 'UP' ? '#3fb950' : '#f85149'} />
        </div>
      )}

      {position ? (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t('longTerm.entry')}>{fmt(position.entryPrice)}</Descriptions.Item>
          <Descriptions.Item label={t('longTerm.stopLoss')}>
            <Space size={6} wrap>
              <span style={{ color: '#f85149' }}>{fmt(position.stopLoss)}</span>
              {position.stage === 1 && <Tag color="processing">{t('longTerm.breakeven')}</Tag>}
              {position.stage >= 2 && <Tag color="success">{t('longTerm.locked')}</Tag>}
            </Space>
          </Descriptions.Item>
          {position.stage > 0 && <Descriptions.Item label={t('longTerm.initialStopLoss')}>{fmt(position.initialStopLoss)}</Descriptions.Item>}
          <Descriptions.Item label={t('longTerm.step1')}>
            {fmt(step !== null ? position.entryPrice + sign * step : null)} {position.stage >= 1 && <Tag color="success">{t('longTerm.reached')}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label={t('longTerm.step2')}>
            {fmt(step !== null ? position.entryPrice + sign * 2 * step : null)} {position.stage >= 2 && <Tag color="success">{t('longTerm.reached')}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label={t('longTerm.tp1')}>
            {fmt(position.takeProfit1)} {reached(1)}
          </Descriptions.Item>
          <Descriptions.Item label={t('longTerm.tp2')}>
            {fmt(position.takeProfit2)} {reached(2)}
          </Descriptions.Item>
          <Descriptions.Item label={t('longTerm.tp3')}>
            <b style={{ color: '#3fb950' }}>{fmt(position.takeProfit3)}</b>
          </Descriptions.Item>
          <Descriptions.Item label={t('longTerm.riskReward')}>{riskReward !== null ? `1 : ${riskReward.toFixed(2)}` : '—'}</Descriptions.Item>
          <Descriptions.Item label={t('market.currentPrice')}>{fmt(currentPrice)}</Descriptions.Item>
          <Descriptions.Item label={t('signal.pnlPoints')}>
            <span style={{ color: pnl !== null && pnl < 0 ? '#f85149' : '#3fb950' }}>{fmt(pnl)}</span>
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">{t('longTerm.noPosition')}</Typography.Text>
          {output?.potentialStopLoss != null && (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('longTerm.potentialStopLoss')}>{fmt(output.potentialStopLoss)}</Descriptions.Item>
            </Descriptions>
          )}
        </Space>
      )}

      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
        {position ? t('longTerm.singleTrade') : t('longTerm.rules')}
      </Typography.Paragraph>

      <Space wrap style={{ marginTop: 16 }}>
        <Button type={paused ? 'primary' : 'default'} disabled={!me} loading={toggleAnalysis.isPending} onClick={handleToggle}>
          {paused ? t('signal.resume') : t('signal.pause')}
        </Button>
        <ClosePositionButton strategy={LONG_TERM} />
      </Space>
    </Card>
  );
}
