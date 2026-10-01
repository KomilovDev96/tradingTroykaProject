import { Space } from 'antd';
import { OpenTrades } from '../../widgets/open-trades/OpenTrades';
import { TradeHistoryTable } from '../../widgets/trade-history-table/TradeHistoryTable';

export function TradesPage() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: 24 }}>
      <OpenTrades />
      <TradeHistoryTable />
    </Space>
  );
}
