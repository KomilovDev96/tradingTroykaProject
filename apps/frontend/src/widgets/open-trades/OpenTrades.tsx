import { useEffect, useState } from 'react';
import { Card, Table, Tag } from 'antd';
import { useOpenTradesQuery } from '../../entities/trade/api/queries';
import type { TradeDTO } from '../../entities/trade/model/types';
import { LONG_TERM, type StrategyId } from '../../entities/strategy/model/types';
import { useMarketStore } from '../../entities/market/model/store';
import { useMeQuery } from '../../entities/session/api/session';
import { ClosePositionButton } from '../../features/close-position/ui/ClosePositionButton';
import { useT } from '../../shared/i18n';

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Without `strategy` (trade journal): both strategies, with a column saying which. */
export function OpenTrades({ strategy }: { strategy?: StrategyId }) {
  const { data: trades = [] } = useOpenTradesQuery(strategy);
  const currentPrice = useMarketStore((s) => s.output?.currentPrice ?? null);
  const [now, setNow] = useState(() => Date.now());
  const t = useT();
  const canTrade = useMeQuery().data?.role !== 'SUPERADMIN';

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card title={t('trades.open')}>
      <Table<TradeDTO>
        scroll={{ x: 'max-content' }}
        size="small"
        rowKey="id"
        dataSource={trades}
        pagination={false}
        locale={{ emptyText: t('trades.noOpen') }}
        columns={[
          { title: t('trades.colSymbol'), dataIndex: 'symbol' },
          ...(strategy ? [] : [{ title: t('trades.colStrategy'), dataIndex: 'strategy', render: (s: string) => t(s === LONG_TERM ? 'strategyName.longTerm' : 'strategyName.scalping') }]),
          { title: t('trades.colDirection'), dataIndex: 'direction', render: (d: string) => <Tag color={d === 'BUY' ? 'success' : 'error'}>{d}</Tag> },
          { title: t('trades.colEntry'), dataIndex: 'entryPrice', render: (v: number) => v.toFixed(2) },
          { title: 'Stop Loss', dataIndex: 'stopLoss', render: (v: number) => v.toFixed(2) },
          ...(strategy === LONG_TERM ? [{ title: 'TP3', dataIndex: 'takeProfit3', render: (v: number | null) => (v === null ? '—' : v.toFixed(2)) }] : []),
          { title: t('trades.colCurrent'), render: () => (currentPrice !== null ? currentPrice.toFixed(2) : '—') },
          {
            title: t('signal.pnlPoints'),
            render: (_, trade) => {
              if (currentPrice === null) return '—';
              const pnl = trade.direction === 'BUY' ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
              return <span style={{ color: pnl >= 0 ? '#3fb950' : '#f85149' }}>{pnl.toFixed(2)}</span>;
            },
          },
          { title: t('trades.colDuration'), render: (_, trade) => formatDuration(now - trade.confirmationTime) },
          ...(canTrade ? [{ title: '', key: 'close', render: (_: unknown, trade: TradeDTO) => <ClosePositionButton strategy={trade.strategy as StrategyId} size="small" /> }] : []),
        ]}
      />
    </Card>
  );
}
