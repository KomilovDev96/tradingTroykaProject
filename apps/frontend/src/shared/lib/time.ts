import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const BROWSER_TIMEZONE = dayjs.tz.guess();

/** One display timezone for the whole app (tables, chart, AI page); picked in the header or settings. */
export const TIMEZONE_OPTIONS = Array.from(
  new Set([BROWSER_TIMEZONE, 'Asia/Tashkent', 'UTC', 'Europe/Moscow', 'Europe/London', 'America/New_York', 'Asia/Dubai']),
).map((tz) => ({ value: tz, label: tz }));

const TZ_STORAGE_KEY = 'bkx-signals.timezone';

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function readStoredTimezone(): string {
  try {
    const stored = localStorage.getItem(TZ_STORAGE_KEY);
    if (stored && isValidTimezone(stored)) return stored;
  } catch {
    // Storage may be unavailable; fall back to the browser's own zone.
  }
  return BROWSER_TIMEZONE;
}

export function storeTimezone(tz: string) {
  try {
    localStorage.setItem(TZ_STORAGE_KEY, tz);
  } catch {
    // Not persisted, still applied for this visit.
  }
}

/** All engine timestamps are ms-epoch UTC; this renders them in the chosen display timezone. */
export function formatTime(ms: number | null | undefined, tz: string, pattern = 'HH:mm:ss'): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  return dayjs(ms).tz(tz).format(pattern);
}

export function formatDateTime(ms: number | null | undefined, tz: string): string {
  return formatTime(ms, tz, 'DD.MM.YYYY HH:mm:ss');
}
