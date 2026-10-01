import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

export type PeriodKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'custom';

export interface PeriodRange {
  from: number;
  to: number;
}

/** Section 43 — period boundaries are computed in the user's chosen display timezone. */
export function resolvePeriod(period: PeriodKey, tz: string, custom?: PeriodRange): PeriodRange {
  const now = dayjs().tz(tz);

  switch (period) {
    case 'today':
      return { from: now.startOf('day').valueOf(), to: now.endOf('day').valueOf() };
    case 'yesterday': {
      const y = now.subtract(1, 'day');
      return { from: y.startOf('day').valueOf(), to: y.endOf('day').valueOf() };
    }
    case 'this_week':
      return { from: now.startOf('isoWeek').valueOf(), to: now.endOf('isoWeek').valueOf() };
    case 'last_week': {
      const lw = now.subtract(1, 'week');
      return { from: lw.startOf('isoWeek').valueOf(), to: lw.endOf('isoWeek').valueOf() };
    }
    case 'this_month':
      return { from: now.startOf('month').valueOf(), to: now.endOf('month').valueOf() };
    case 'custom':
      return custom ?? { from: now.startOf('day').valueOf(), to: now.endOf('day').valueOf() };
  }
}
