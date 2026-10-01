import { Card, Descriptions } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { formatTime } from '../../shared/lib/time';

function fmt(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : value.toFixed(2);
}

export function StrategyPanel() {
  const output = useMarketStore((s) => s.output);
  const timezone = useMarketStore((s) => s.timezone);

  return (
    <Card title="Стратегия «Тройка» — 3-часовой диапазон">
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="Начало">{output ? formatTime(output.rangeStart, timezone) : '—'}</Descriptions.Item>
        <Descriptions.Item label="Конец">{output ? formatTime(output.rangeEnd, timezone) : '—'}</Descriptions.Item>
        <Descriptions.Item label="Максимум спроса">{fmt(output?.highDemand)}</Descriptions.Item>
        <Descriptions.Item label="Минимум спроса">{fmt(output?.lowDemand)}</Descriptions.Item>
        <Descriptions.Item label="Диапазон">{output?.rangePoints !== null && output?.rangePoints !== undefined ? `${fmt(output.rangePoints)} пунктов` : '—'}</Descriptions.Item>
        <Descriptions.Item label="Текущая цена">{fmt(output?.currentPrice)}</Descriptions.Item>
        <Descriptions.Item label="Верхний уровень">{fmt(output?.upperLevel)}</Descriptions.Item>
        <Descriptions.Item label="Нижний уровень">{fmt(output?.lowerLevel)}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
