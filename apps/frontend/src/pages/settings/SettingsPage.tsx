import { Card, Descriptions, Select, Space } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { BACKEND_HTTP_URL, BACKEND_WS_URL } from '../../shared/api/config';
import { BROWSER_TIMEZONE } from '../../shared/lib/time';

const TIMEZONE_OPTIONS = Array.from(
  new Set([BROWSER_TIMEZONE, 'UTC', 'Europe/Moscow', 'Europe/London', 'America/New_York', 'Asia/Dubai']),
).map((tz) => ({ value: tz, label: tz }));

export function SettingsPage() {
  const instrument = useMarketStore((s) => s.instrument);
  const timezone = useMarketStore((s) => s.timezone);
  const setTimezone = useMarketStore((s) => s.setTimezone);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: 24 }}>
      <Card title="Настройки">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Инструмент">{instrument ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Стратегия">TROYKA</Descriptions.Item>
          <Descriptions.Item label="Таймфрейм">5м</Descriptions.Item>
          <Descriptions.Item label="Backend HTTP">{BACKEND_HTTP_URL}</Descriptions.Item>
          <Descriptions.Item label="Backend WebSocket">{BACKEND_WS_URL}</Descriptions.Item>
          <Descriptions.Item label="Статус соединения">{connectionStatus === 'open' ? 'подключено' : connectionStatus === 'connecting' ? 'подключение...' : 'нет связи'}</Descriptions.Item>
          <Descriptions.Item label="Часовой пояс отображения">
            <Select size="small" style={{ width: 240 }} value={timezone} onChange={setTimezone} options={TIMEZONE_OPTIONS} />
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}
