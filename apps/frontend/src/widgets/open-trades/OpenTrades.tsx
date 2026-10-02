import { useEffect, useState } from 'react';
import { Card, Table, Tag } from 'antd';
import { useOpenTradesQuery } from '../../entities/trade/api/queries';
import type { TradeDTO } from '../../entities/trade/model/types';
import { useMarketStore } from '../../entities/market/model/store';

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function OpenTrades() {
  const { data: trades = [] } = useOpenTradesQuery();
  const currentPrice = useMarketStore((s) => s.output?.currentPrice ?? null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card title="Открытые сделки">
      <Table<TradeDTO>
        scroll={{ x: 'max-content' }}
        size="small"
        rowKey="id"
        dataSource={trades}
        pagination={false}
        locale={{ emptyText: 'Нет открытых сделок' }}
        columns={[
          { title: 'Символ', dataIndex: 'symbol' },
          { title: 'Направление', dataIndex: 'direction', render: (d: string) => <Tag color={d === 'BUY' ? 'success' : 'error'}>{d}</Tag> },
          { title: 'Вход', dataIndex: 'entryPrice', render: (v: number) => v.toFixed(2) },
          { title: 'Stop Loss', dataIndex: 'stopLoss', render: (v: number) => v.toFixed(2) },
          { title: 'Текущая', render: () => (currentPrice !== null ? currentPrice.toFixed(2) : '—') },
          {
            title: 'P&L (пункты)',
            render: (_, t) => {
              if (currentPrice === null) return '—';
              const pnl = t.direction === 'BUY' ? currentPrice - t.entryPrice : t.entryPrice - currentPrice;
              return <span style={{ color: pnl >= 0 ? '#3fb950' : '#f85149' }}>{pnl.toFixed(2)}</span>;
            },
          },
          { title: 'Длительность', render: (_, t) => formatDuration(now - t.confirmationTime) },
        ]}
      />
    </Card>
  );
}
