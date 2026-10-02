import { Card, Descriptions } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { formatTime } from '../../shared/lib/time';
import { useT } from '../../shared/i18n';

function fmt(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : value.toFixed(2);
}

export function StrategyPanel() {
  const output = useMarketStore((s) => s.output);
  const timezone = useMarketStore((s) => s.timezone);
  const t = useT();

  return (
    <Card title={t('strategy.title')}>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
        <Descriptions.Item label={t('strategy.start')}>{output ? formatTime(output.rangeStart, timezone) : '—'}</Descriptions.Item>
        <Descriptions.Item label={t('strategy.end')}>{output ? formatTime(output.rangeEnd, timezone) : '—'}</Descriptions.Item>
        <Descriptions.Item label={t('strategy.highDemand')}>{fmt(output?.highDemand)}</Descriptions.Item>
        <Descriptions.Item label={t('strategy.lowDemand')}>{fmt(output?.lowDemand)}</Descriptions.Item>
        <Descriptions.Item label={t('strategy.range')}>{output?.rangePoints !== null && output?.rangePoints !== undefined ? t('strategy.rangePoints', { n: fmt(output.rangePoints) }) : '—'}</Descriptions.Item>
        <Descriptions.Item label={t('market.currentPrice')}>{fmt(output?.currentPrice)}</Descriptions.Item>
        <Descriptions.Item label={t('strategy.upperLevel')}>{fmt(output?.upperLevel)}</Descriptions.Item>
        <Descriptions.Item label={t('strategy.lowerLevel')}>{fmt(output?.lowerLevel)}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
