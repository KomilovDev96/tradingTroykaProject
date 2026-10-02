import { DatePicker, Grid, Segmented, Select } from 'antd';
import dayjs from 'dayjs';
import type { PeriodKey, PeriodRange } from '../lib/period';
import { useT } from '../i18n';

const PERIODS: PeriodKey[] = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'custom'];

interface PeriodSelectorProps {
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
  customRange?: PeriodRange;
  onCustomRangeChange: (range: PeriodRange) => void;
}

/** Section 43 — Today / Yesterday / This Week / Last Week / This Month / Custom Range. */
export function PeriodSelector({ period, onPeriodChange, customRange, onCustomRangeChange }: PeriodSelectorProps) {
  const screens = Grid.useBreakpoint();
  const t = useT();
  const options = PERIODS.map((value) => ({ value, label: t(`period.${value}`) }));

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {screens.md ? (
        <Segmented options={options} value={period} onChange={(v) => onPeriodChange(v as PeriodKey)} />
      ) : (
        <Select options={options} value={period} onChange={onPeriodChange} style={{ width: '100%' }} />
      )}
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
