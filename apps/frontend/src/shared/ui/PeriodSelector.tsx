import { DatePicker, Segmented } from 'antd';
import dayjs from 'dayjs';
import type { PeriodKey, PeriodRange } from '../lib/period';

const OPTIONS: { label: string; value: PeriodKey }[] = [
  { label: 'Сегодня', value: 'today' },
  { label: 'Вчера', value: 'yesterday' },
  { label: 'Эта неделя', value: 'this_week' },
  { label: 'Прошлая неделя', value: 'last_week' },
  { label: 'Этот месяц', value: 'this_month' },
  { label: 'Свой период', value: 'custom' },
];

interface PeriodSelectorProps {
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
  customRange?: PeriodRange;
  onCustomRangeChange: (range: PeriodRange) => void;
}

/** Section 43 — Today / Yesterday / This Week / Last Week / This Month / Custom Range. */
export function PeriodSelector({ period, onPeriodChange, customRange, onCustomRangeChange }: PeriodSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <Segmented options={OPTIONS} value={period} onChange={(v) => onPeriodChange(v as PeriodKey)} />
      {period === 'custom' && (
        <DatePicker.RangePicker
          value={customRange ? [dayjs(customRange.from), dayjs(customRange.to)] : undefined}
          onChange={(range) => {
            if (range?.[0] && range?.[1]) {
              onCustomRangeChange({ from: range[0].startOf('day').valueOf(), to: range[1].endOf('day').valueOf() });
            }
          }}
        />
      )}
    </div>
  );
}
