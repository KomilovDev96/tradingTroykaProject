import { Space } from 'antd';
import { OpenTrades } from '../../widgets/open-trades/OpenTrades';
import { TradeHistoryTable } from '../../widgets/trade-history-table/TradeHistoryTable';

export function TradesPage() {
  return (
    <Space orientation="vertical" size="large" className="page">
      <OpenTrades />
      <TradeHistoryTable />
    </Space>
  );
}
