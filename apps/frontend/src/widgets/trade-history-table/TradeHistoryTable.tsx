import { useState } from 'react';
import { Button, Card, DatePicker, Select, Space, Table } from 'antd';
import { useTradesQuery } from '../../entities/trade/api/queries';
import type { TradeDTO, TradeFilters } from '../../entities/trade/model/types';
import { LONG_TERM, SCALPING } from '../../entities/strategy/model/types';
import { exportTradesCsv } from '../../features/export-trades/model/useExportTrades';
import { useT } from '../../shared/i18n';
import { useTradeHistoryColumns } from './useTradeHistoryColumns';

export function TradeHistoryTable() {
  const [filters, setFilters] = useState<TradeFilters>({});
  const t = useT();
  const columns = useTradeHistoryColumns();

  const { data: trades = [], isLoading } = useTradesQuery(filters);

  return (
    <Card
      title={t('trades.history')}
      extra={
        <Button size="small" onClick={() => exportTradesCsv(filters)}>
          {t('trades.exportCsv')}
        </Button>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker
          placeholder={[t('trades.dateFrom'), t('trades.dateTo')]}
          onChange={(range) =>
            setFilters((f) => ({
              ...f,
              from: range?.[0] ? range[0].startOf('day').valueOf() : undefined,
              to: range?.[1] ? range[1].endOf('day').valueOf() : undefined,
            }))
          }
        />
        <Select
          allowClear
          placeholder={t('trades.colStrategy')}
          style={{ width: 200 }}
          options={[
            { value: SCALPING, label: t('strategyName.scalping') },
            { value: LONG_TERM, label: t('strategyName.longTerm') },
          ]}
          onChange={(v) => setFilters((f) => ({ ...f, strategy: v }))}
        />
        <Select
          allowClear
          placeholder={t('trades.colDirection')}
          style={{ width: 140 }}
          options={[
            { value: 'BUY', label: 'BUY' },
            { value: 'SELL', label: 'SELL' },
          ]}
          onChange={(v) => setFilters((f) => ({ ...f, direction: v }))}
        />
        <Select
          allowClear
          placeholder={t('trades.colResult')}
          style={{ width: 180 }}
          options={[
            { value: 'PROFIT', label: t('result.PROFIT') },
            { value: 'STOP_LOSS', label: t('result.STOP_LOSS') },
            { value: 'MANUAL_CLOSE', label: t('result.MANUAL_CLOSE') },
          ]}
          onChange={(v) => setFilters((f) => ({ ...f, result: v }))}
        />
        <Select
          allowClear
          placeholder={t('trades.colStatus')}
          style={{ width: 160 }}
          options={[
            { value: 'OPEN', label: t('status.OPEN') },
            { value: 'CLOSED', label: t('status.CLOSED') },
            { value: 'STOP_LOSS', label: t('status.STOP_LOSS') },
          ]}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
        />
      </Space>

      <Table<TradeDTO>
        scroll={{ x: 'max-content' }}
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={trades}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: t('trades.noData') }}
        columns={columns}
      />
    </Card>
  );
}
