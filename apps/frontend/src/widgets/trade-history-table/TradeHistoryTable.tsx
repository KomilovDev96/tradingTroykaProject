import { useState } from 'react';
import { Button, Card, DatePicker, Select, Space, Table, Tag } from 'antd';
import { useTradesQuery } from '../../entities/trade/api/queries';
import type { TradeDTO, TradeFilters } from '../../entities/trade/model/types';
import { exportTradesCsv } from '../../features/export-trades/model/useExportTrades';
import { useMarketStore } from '../../entities/market/model/store';
import { formatDateTime } from '../../shared/lib/time';

const RESULT_COLOR: Record<string, string> = { PROFIT: 'success', STOP_LOSS: 'error', MANUAL_CLOSE: 'default' };
const RESULT_LABEL: Record<string, string> = { PROFIT: 'ПРИБЫЛЬ', STOP_LOSS: 'СТОП-ЛОСС', MANUAL_CLOSE: 'ЗАКРЫТО ВРУЧНУЮ' };
const STATUS_COLOR: Record<string, string> = { OPEN: 'processing', CLOSED: 'default', STOP_LOSS: 'error' };
const STATUS_LABEL: Record<string, string> = { OPEN: 'ОТКРЫТА', CLOSED: 'ЗАКРЫТА', STOP_LOSS: 'СТОП-ЛОСС' };

export function TradeHistoryTable() {
  const timezone = useMarketStore((s) => s.timezone);
  const [filters, setFilters] = useState<TradeFilters>({});

  const { data: trades = [], isLoading } = useTradesQuery(filters);

  return (
    <Card
      title="История сделок"
      extra={
        <Button size="small" onClick={() => exportTradesCsv(filters)}>
          Экспорт в CSV
        </Button>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker
          placeholder={['Дата с', 'Дата по']}
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
          placeholder="Направление"
          style={{ width: 140 }}
          options={[
            { value: 'BUY', label: 'BUY' },
            { value: 'SELL', label: 'SELL' },
          ]}
          onChange={(v) => setFilters((f) => ({ ...f, direction: v }))}
        />
        <Select
          allowClear
          placeholder="Результат"
          style={{ width: 180 }}
          options={[
            { value: 'PROFIT', label: 'ПРИБЫЛЬ' },
            { value: 'STOP_LOSS', label: 'СТОП-ЛОСС' },
            { value: 'MANUAL_CLOSE', label: 'ЗАКРЫТО ВРУЧНУЮ' },
          ]}
          onChange={(v) => setFilters((f) => ({ ...f, result: v }))}
        />
        <Select
          allowClear
          placeholder="Статус"
          style={{ width: 160 }}
          options={[
            { value: 'OPEN', label: 'ОТКРЫТА' },
            { value: 'CLOSED', label: 'ЗАКРЫТА' },
            { value: 'STOP_LOSS', label: 'СТОП-ЛОСС' },
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
        locale={{ emptyText: 'Нет данных' }}
        columns={[
          { title: 'Дата', dataIndex: 'createdAt', render: (t: number) => formatDateTime(t, timezone) },
          { title: 'Символ', dataIndex: 'symbol' },
          { title: 'Направление', dataIndex: 'direction', render: (d: string) => <Tag color={d === 'BUY' ? 'success' : 'error'}>{d}</Tag> },
          { title: 'Вход', dataIndex: 'entryPrice', render: (v: number) => v.toFixed(2) },
          { title: 'Выход', dataIndex: 'exitPrice', render: (v?: number) => (v !== null && v !== undefined ? v.toFixed(2) : '—') },
          { title: 'SL', dataIndex: 'stopLoss', render: (v: number) => v.toFixed(2) },
          {
            title: 'P&L',
            dataIndex: 'pnlPoints',
            render: (v?: number) => (v !== null && v !== undefined ? <span style={{ color: v >= 0 ? '#3fb950' : '#f85149' }}>{v.toFixed(2)}</span> : '—'),
          },
          { title: 'Статус', dataIndex: 'status', render: (s: string) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag> },
          {
            title: 'Результат',
            dataIndex: 'result',
            render: (r?: string) => (r ? <Tag color={RESULT_COLOR[r]}>{RESULT_LABEL[r] ?? r}</Tag> : '—'),
          },
        ]}
      />
    </Card>
  );
}
