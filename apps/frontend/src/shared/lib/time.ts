import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const BROWSER_TIMEZONE = dayjs.tz.guess();

/** All engine timestamps are ms-epoch UTC; this renders them in the chosen display timezone. */
export function formatTime(ms: number | null | undefined, tz: string, pattern = 'HH:mm:ss'): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  return dayjs(ms).tz(tz).format(pattern);
}

export function formatDateTime(ms: number | null | undefined, tz: string): string {
  return formatTime(ms, tz, 'DD.MM.YYYY HH:mm:ss');
}
