import { Alert, Button, Card, Descriptions, Progress, Space, Tag, message } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { useClosePosition } from '../../features/close-position/model/useClosePosition';
import { useToggleAnalysis } from '../../features/toggle-analysis/model/useToggleAnalysis';

function fmt(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : value.toFixed(2);
}

const SIGNAL_COLOR: Record<string, string> = { BUY: 'success', SELL: 'error', WAIT: 'default' };
const DIRECTION_LABEL: Record<string, string> = { UP: 'ВВЕРХ', DOWN: 'ВНИЗ' };

export function SignalPanel() {
  const output = useMarketStore((s) => s.output);
  const closePosition = useClosePosition();
  const toggleAnalysis = useToggleAnalysis();
  const paused = output?.paused ?? false;

  const phase = output?.phase ?? 'WAITING';
  const isActive = phase === 'BUY_ACTIVE' || phase === 'SELL_ACTIVE';
  const isTrackingMovement = phase === 'ANALYZING_15M' || phase === 'BUY_READY' || phase === 'SELL_READY';

  const durationMin = output?.movementDuration ?? 0;
  const progressPercent = Math.min(100, Math.round((durationMin / 15) * 100));

  const handleClose = async () => {
    try {
      await closePosition.mutateAsync();
      message.success('Позиция отмечена как закрытая (виртуальный анализ, реальный ордер не отправлялся).');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось закрыть позицию');
    }
  };

  const handleToggle = async () => {
    try {
      await toggleAnalysis.mutateAsync(!paused);
      message.success(paused ? 'Анализ продолжен.' : 'Анализ остановлен — новые сигналы не ищутся.');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось переключить анализ');
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Текущий сигнал</span>
        <Tag color={SIGNAL_COLOR[output?.signal ?? 'WAIT']} style={{ fontSize: 16, padding: '2px 12px', margin: 0 }}>
          {output?.signal === 'BUY' ? 'BUY' : output?.signal === 'SELL' ? 'SELL' : paused ? 'ПАУЗА' : 'ОЖИДАНИЕ'}
        </Tag>
      </div>
      {paused && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Анализ остановлен"
          description={
            isActive
              ? 'Новые сигналы не ищутся. Stop Loss открытой позиции по-прежнему отслеживается.'
              : 'Новые сигналы не ищутся. Цена и график продолжают обновляться.'
          }
        />
      )}
      {isTrackingMovement && (
        <div style={{ marginBottom: 16 }}>
          <div>Прогресс подтверждения 15М ({output?.movementDirection ? DIRECTION_LABEL[output.movementDirection] : '—'})</div>
          <Progress percent={progressPercent} status={phase.includes('READY') ? 'active' : 'normal'} />
        </div>
      )}

      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Потенциальная точка входа">{fmt(output?.potentialEntryPrice)}</Descriptions.Item>
        <Descriptions.Item label="Потенциальный Stop Loss">{fmt(output?.potentialStopLoss)}</Descriptions.Item>
        <Descriptions.Item label="Вход (подтверждён)">{fmt(output?.entryPrice)}</Descriptions.Item>
        <Descriptions.Item label="Stop Loss (подтверждён)">{fmt(output?.stopLoss)}</Descriptions.Item>
        <Descriptions.Item label="Длительность движения">{output ? `${durationMin} мин` : '—'}</Descriptions.Item>
        {isActive && output?.entryPrice !== null && (
          <>
            <Descriptions.Item label="Текущая цена">{fmt(output?.currentPrice)}</Descriptions.Item>
            <Descriptions.Item label="P&L (пункты)">
              {output && output.entryPrice !== null
                ? fmt(output.signal === 'BUY' ? output.currentPrice - output.entryPrice : output.entryPrice - output.currentPrice)
                : '—'}
            </Descriptions.Item>
          </>
        )}
      </Descriptions>

      <Space wrap style={{ marginTop: 16 }}>
        <Button
          type={paused ? 'primary' : 'default'}
          disabled={!output}
          loading={toggleAnalysis.isPending}
          onClick={handleToggle}
        >
          {paused ? '▶ Продолжить анализ' : '⏸ Остановить анализ'}
        </Button>
        {isActive && (
          <Button danger loading={closePosition.isPending} onClick={handleClose}>
            Закрыть анализ / Позиция закрыта
          </Button>
        )}
      </Space>
    </Card>
  );
}
