// Helpers shared by every date-range filter (dashboard summary, performance
// reports and the ticket archive). The native <input type="date"> control emits
// an ISO `YYYY-MM-DD` string (or '' when empty), which sorts lexicographically,
// so a plain string comparison is enough to validate the range.

export interface DateRange {
  start_date?: string;
  end_date?: string;
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
