import { Alert, Card, Descriptions } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { useT } from '../../shared/i18n';

/** PDF section 3/8: the market speedometer — 8-day ADR, hourly speed, breakeven step and TP distances. */
export function SpeedometerCard() {
  const t = useT();
  const speed = useMarketStore((s) => s.longTermOutput?.speedometer ?? null);

  return (
    <Card title={t('speed.title')}>
      {speed ? (
        <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
          <Descriptions.Item label={t('speed.lookback')}>
            {t('speed.lookbackValue', { days: speed.lookbackDays, hours: speed.lookbackDays * 24 })}
          </Descriptions.Item>
          <Descriptions.Item label={t('speed.hourly')}>{t('strategy.rangePoints', { n: speed.hourlySpeed.toFixed(2) })}</Descriptions.Item>
          <Descriptions.Item label={t('speed.daily')}>
            <b style={{ color: '#ffb300' }}>{t('strategy.rangePoints', { n: speed.dailySpeed.toFixed(2) })}</b>
          </Descriptions.Item>
          <Descriptions.Item label={t('speed.step')}>{t('strategy.rangePoints', { n: speed.step.toFixed(2) })}</Descriptions.Item>
          <Descriptions.Item label={t('speed.targets')} span={2}>
            {[1, 2, 3].map((x) => (speed.dailySpeed * x).toFixed(2)).join(' / ')}
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Alert type="info" showIcon title={t('speed.noData')} />
      )}
    </Card>
  );
}
