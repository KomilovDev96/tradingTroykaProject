import { Alert, App, Button, Card, Col, Descriptions, Empty, List, Progress, Row, Space, Statistic, Switch, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useAiClosePosition, useAiToggle, useAiStatus, type AiAnalysis } from '../../entities/ai/api/ai';
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
  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <Space wrap>
        <Tag color={DECISION_COLOR[item.decision]}>{item.decision === 'SKIP' ? t('ai.skip') : item.decision}</Tag>
        <Typography.Text type="secondary">{new Date(item.time).toLocaleTimeString()}</Typography.Text>
        <Typography.Text type="secondary">
          {fmtInt(item.inputTokens)} + {fmtInt(item.outputTokens)} {t('ai.tokens')}
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

/** «ИИ-стратегия» (super admin only): Claude finds entry/stop/target; code opens, protects and trails the position. */
export function AiPage() {
  const t = useT();
  const { message } = App.useApp();
  const { data: status } = useAiStatus();
  const toggle = useAiToggle();
  const close = useAiClosePosition();
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

  const handleClose = async () => {
    try {
      await close.mutateAsync();
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

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title={t('ai.position')} extra={pos && <Button danger size="small" loading={close.isPending} onClick={handleClose}>{t('ai.closePosition')}</Button>}>
            {pos ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label={t('ai.direction')}>
                  <Tag color={pos.direction === 'BUY' ? 'success' : 'error'}>{pos.direction}</Tag>
                  {pos.stage >= 1 && <Tag color="processing">{t('ai.breakeven')}</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label={t('ai.entry')}>{fmt(pos.entryPrice)}</Descriptions.Item>
                <Descriptions.Item label="Stop Loss">{fmt(pos.stopLoss)}</Descriptions.Item>
                <Descriptions.Item label={t('ai.initialStop')}>{fmt(pos.initialStopLoss)}</Descriptions.Item>
                <Descriptions.Item label={t('ai.takeProfit')}>{fmt(pos.takeProfit)}</Descriptions.Item>
                <Descriptions.Item label={t('ai.price')}>{fmt(status.price)}</Descriptions.Item>
                <Descriptions.Item label="PnL">
                  <Typography.Text type={pos.pnlPoints >= 0 ? 'success' : 'danger'}>{pos.pnlPoints >= 0 ? '+' : ''}{pos.pnlPoints.toFixed(2)}</Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description={t('ai.noPosition')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title={t('ai.usage')}>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col span={8}><Statistic title={t('ai.requests')} value={status.usage.requests} /></Col>
                <Col span={8}><Statistic title={t('ai.tokensIn')} value={status.usage.inputTokens} /></Col>
                <Col span={8}><Statistic title={t('ai.tokensOut')} value={status.usage.outputTokens} /></Col>
              </Row>
              {rate && (
                <>
                  <Limit label={t('ai.limitRequests')} remaining={rate.requestsRemaining} limit={rate.requestsLimit} />
                  <Limit label={t('ai.limitIn')} remaining={rate.inputTokensRemaining} limit={rate.inputTokensLimit} />
                  <Limit label={t('ai.limitOut')} remaining={rate.outputTokensRemaining} limit={rate.outputTokensLimit} />
                </>
              )}
              <Typography.Text type="secondary">{t('ai.balanceNote')}</Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title={t('ai.lastAnalysis')}>{status.last ? <AnalysisBlock item={status.last} /> : <Empty description={t('ai.noAnalysis')} image={Empty.PRESENTED_IMAGE_SIMPLE} />}</Card>

      {status.history.length > 1 && (
        <Card title={t('ai.history')}>
          <List dataSource={status.history.slice(1)} renderItem={(item) => <List.Item key={item.id}><AnalysisBlock item={item} /></List.Item>} />
        </Card>
      )}
    </Space>
  );
}
