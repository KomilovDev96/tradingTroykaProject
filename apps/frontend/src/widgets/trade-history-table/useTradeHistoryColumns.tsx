import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMarketStore } from '../../entities/market/model/store';
import type { TradeDTO } from '../../entities/trade/model/types';
import { useT, type TranslationKey } from '../../shared/i18n';
import { formatDateTime } from '../../shared/lib/time';

const RESULT_COLOR: Record<string, string> = { PROFIT: 'success', STOP_LOSS: 'error', MANUAL_CLOSE: 'default' };
const STATUS_COLOR: Record<string, string> = { OPEN: 'processing', CLOSED: 'default', STOP_LOSS: 'error' };

/** Trade history columns — shared by the user's own history and the admin's per-user view. */
export function useTradeHistoryColumns(): ColumnsType<TradeDTO> {
  const timezone = useMarketStore((s) => s.timezone);
  const t = useT();
  return [
    { title: t('trades.colDate'), dataIndex: 'createdAt', render: (time: number) => formatDateTime(time, timezone) },
    { title: t('trades.colSymbol'), dataIndex: 'symbol' },
    { title: t('trades.colDirection'), dataIndex: 'direction', render: (d: string) => <Tag color={d === 'BUY' ? 'success' : 'error'}>{d}</Tag> },
    { title: t('trades.colEntry'), dataIndex: 'entryPrice', render: (v: number) => v.toFixed(2) },
    { title: t('trades.colExit'), dataIndex: 'exitPrice', render: (v?: number) => (v !== null && v !== undefined ? v.toFixed(2) : '—') },
    { title: 'SL', dataIndex: 'stopLoss', render: (v: number) => v.toFixed(2) },
    {
      title: 'P&L',
      dataIndex: 'pnlPoints',
      render: (v?: number) => (v !== null && v !== undefined ? <span style={{ color: v >= 0 ? '#3fb950' : '#f85149' }}>{v.toFixed(2)}</span> : '—'),
    },
    {
      title: t('trades.colStatus'),
      dataIndex: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{t(`status.${s}` as TranslationKey)}</Tag>,
    },
    {
      title: t('trades.colResult'),
      dataIndex: 'result',
      render: (r?: string) => (r ? <Tag color={RESULT_COLOR[r]}>{t(`result.${r}` as TranslationKey)}</Tag> : '—'),
    },
  ];
}

