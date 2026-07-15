// Helpers shared by every date-range filter (dashboard summary, performance
// reports and the ticket archive). The native <input type="date"> control emits
// an ISO `YYYY-MM-DD` string (or '' when empty), which sorts lexicographically,
// so a plain string comparison is enough to validate the range.

import { todayIsoDate } from './datetime';

export interface DateRange {
  start_date?: string;
  end_date?: string;
}

// The default start/end shown when a date-range filter first loads: the last
// week, i.e. today minus 6 days through today (7 inclusive days), in Israel
// local time. Every filter (Manager/Secretary dashboards, ticket archive) starts
// here so the initial view is scoped to recent activity rather than "all time".
// The user can still widen or change the range afterwards.
export interface DefaultDateRange {
  start_date: string;
  end_date: string;
}

export function getDefaultDateRange(): DefaultDateRange {
  const end = todayIsoDate();
  // Anchor the arithmetic in UTC so the -6 day shift never lands on a DST
  // boundary and always yields a clean calendar date.
  const [year, month, day] = end.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  start.setUTCDate(start.getUTCDate() - 6);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startStr =
    `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`;
  return { start_date: startStr, end_date: end };
}

// Shown when the user picks a start date after the end date.
export const INVALID_DATE_RANGE_MESSAGE = 'תאריך ההתחלה חייב להיות מוקדם מתאריך הסיום.';

// Validates a start/end pair. An empty field means "open ended", so a range is
// only invalid when BOTH ends are set and start is strictly after end. Returns a
// Hebrew error message in that case, otherwise null.
export function validateDateRange(start: string, end: string): string | null {
  if (start && end && start > end) return INVALID_DATE_RANGE_MESSAGE;
  return null;
}

// Builds the query params for an API call, omitting empty fields so an unset
// range sends no date params at all.
export function buildDateRangeParams(start: string, end: string): DateRange {
  const params: DateRange = {};
  if (start) params.start_date = start;
  if (end) params.end_date = end;
  return params;
}
