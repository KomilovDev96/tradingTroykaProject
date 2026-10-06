import { Alert, App, Button, Card, Descriptions, Progress, Space, Tag } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { useMeQuery } from '../../entities/session/api/session';
import { useOpenTradesQuery } from '../../entities/trade/api/queries';
import { SCALPING } from '../../entities/strategy/model/types';
import { ClosePositionButton } from '../../features/close-position/ui/ClosePositionButton';
import { useToggleAnalysis } from '../../features/toggle-analysis/model/useToggleAnalysis';
import { ApiError } from '../../shared/api/httpClient';
import { translateError, useT, type TranslationKey } from '../../shared/i18n';

function fmt(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : value.toFixed(2);
}

const SIGNAL_COLOR: Record<string, string> = { BUY: 'success', SELL: 'error', WAIT: 'default' };

/**
 * The signal (phase, levels, 15M progress) is shared by everyone; the position, its P&L and the
 * close button are this account's own — it may have paused, closed early, or joined after the signal.
 */
export function SignalPanel() {
  const t = useT();
  const { message } = App.useApp();
  const output = useMarketStore((s) => s.output);
  const me = useMeQuery().data;
  const myPosition = useOpenTradesQuery(SCALPING).data?.[0] ?? null;
  const toggleAnalysis = useToggleAnalysis();

  const paused = me?.analysisPaused ?? false;

  const phase = output?.phase ?? 'WAITING';
  const isTrackingMovement = phase === 'ANALYZING_15M' || phase === 'BUY_READY' || phase === 'SELL_READY';

  const durationMin = output?.movementDuration ?? 0;
  const progressPercent = Math.min(100, Math.round((durationMin / 15) * 100));

  const errorText = (err: unknown, fallback: TranslationKey) =>
    err instanceof ApiError ? translateError(t, err.code, err.status) : t(fallback);

  const handleToggle = async () => {
    try {
      await toggleAnalysis.mutateAsync(!paused);
      message.success(paused ? t('signal.resumedOk') : t('signal.pausedOk'));
    } catch (err) {
      message.error(errorText(err, 'signal.toggleFailed'));
    }
  };

  const signalLabel = output?.signal === 'BUY' || output?.signal === 'SELL' ? output.signal : paused ? t('phase.PAUSED') : t('phase.WAITING');
  const myPnl =
    myPosition && output
      ? myPosition.direction === 'BUY'
        ? output.currentPrice - myPosition.entryPrice
        : myPosition.entryPrice - output.currentPrice
      : null;

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{t('signal.title')}</span>
        <Tag color={SIGNAL_COLOR[output?.signal ?? 'WAIT']} style={{ fontSize: 16, padding: '2px 12px', margin: 0 }}>
          {signalLabel}
        </Tag>
      </div>
      {paused && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={t('signal.pausedTitle')}
          description={myPosition ? t('signal.pausedWithPosition') : t('signal.pausedIdle')}
        />
      )}
      {isTrackingMovement && (
        <div style={{ marginBottom: 16 }}>
          <div>
            {t('signal.progress', {
              direction: output?.movementDirection === 'UP' ? t('signal.directionUp') : output?.movementDirection === 'DOWN' ? t('signal.directionDown') : '—',
            })}
          </div>
          <Progress percent={progressPercent} status={phase.includes('READY') ? 'active' : 'normal'} />
        </div>
      )}

      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t('signal.potentialEntry')}>{fmt(output?.potentialEntryPrice)}</Descriptions.Item>
        <Descriptions.Item label={t('signal.potentialStopLoss')}>{fmt(output?.potentialStopLoss)}</Descriptions.Item>
        <Descriptions.Item label={t('signal.entryConfirmed')}>{fmt(myPosition?.entryPrice ?? output?.entryPrice)}</Descriptions.Item>
        <Descriptions.Item label={t('signal.stopLossConfirmed')}>{fmt(myPosition?.stopLoss ?? output?.stopLoss)}</Descriptions.Item>
        <Descriptions.Item label={t('signal.duration')}>{output ? t('signal.minutes', { n: durationMin }) : '—'}</Descriptions.Item>
        {myPosition && (
          <>
            <Descriptions.Item label={t('market.currentPrice')}>{fmt(output?.currentPrice)}</Descriptions.Item>
            <Descriptions.Item label={t('signal.pnlPoints')}>
              <span style={{ color: myPnl !== null && myPnl < 0 ? '#f85149' : '#3fb950' }}>{fmt(myPnl)}</span>
            </Descriptions.Item>
          </>
        )}
      </Descriptions>

      <Space wrap style={{ marginTop: 16 }}>
        <Button type={paused ? 'primary' : 'default'} disabled={!me} loading={toggleAnalysis.isPending} onClick={handleToggle}>
          {paused ? t('signal.resume') : t('signal.pause')}
        </Button>
        <ClosePositionButton strategy={SCALPING} />
      </Space>
    </Card>
  );
}
