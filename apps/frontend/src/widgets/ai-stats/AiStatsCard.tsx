import { Card, Col, Progress, Row, Statistic, Typography } from 'antd';
import type { AiPeriodStats } from '../../entities/ai/api/ai';
import { useT } from '../../shared/i18n';

/** «Как работает ИИ»: what the model answered in the period, how much of it became trades, what it cost. */
export function AiStatsCard({ stats, loading, trades, net }: { stats: AiPeriodStats | undefined; loading: boolean; trades: number; net: number }) {
  const t = useT();
  const requests = stats?.requests ?? 0;
  const tradePercent = requests > 0 ? Math.round(((stats?.opened ?? 0) / requests) * 100) : 0;
  const cost = stats?.costUsd ?? 0;

  return (
    <Card title={t('aiStats.title')} loading={loading}>
      <Typography.Paragraph type="secondary">{t('aiStats.how')}</Typography.Paragraph>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Statistic title={t('ai.requests')} value={requests} /></Col>
        <Col xs={12} md={6}><Statistic title="BUY" value={stats?.buy ?? 0} styles={{ content: { color: '#3fb950' } }} /></Col>
        <Col xs={12} md={6}><Statistic title="SELL" value={stats?.sell ?? 0} styles={{ content: { color: '#f85149' } }} /></Col>
        <Col xs={12} md={6}><Statistic title={t('ai.skip')} value={stats?.skip ?? 0} /></Col>
        <Col xs={12} md={6}><Statistic title={t('aiStats.opened')} value={stats?.opened ?? 0} /></Col>
        <Col xs={12} md={6}><Statistic title={t('aiStats.rejected')} value={stats?.rejected ?? 0} /></Col>
        <Col xs={12} md={6}><Statistic title={t('aiStats.cost')} value={cost} prefix="$" precision={4} /></Col>
        <Col xs={12} md={6}><Statistic title={t('aiStats.costPerTrade')} value={trades > 0 ? cost / trades : 0} prefix="$" precision={4} /></Col>
      </Row>
      <div style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">{t('aiStats.tradeShare')}: {tradePercent}%</Typography.Text>
        <Progress percent={tradePercent} size="small" showInfo={false} />
      </div>
      <Typography.Text type="secondary">
        {t('aiStats.net')}: {net >= 0 ? '+' : ''}{net.toFixed(2)} {t('ai.points')} · {t('ai.tokensIn')}: {(stats?.inputTokens ?? 0).toLocaleString('ru-RU')} · {t('ai.tokensOut')}: {(stats?.outputTokens ?? 0).toLocaleString('ru-RU')}
      </Typography.Text>
    </Card>
  );
}
