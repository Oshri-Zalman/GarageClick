// Centralized date/time formatting for the whole frontend UI.
//
// The backend stores and returns timestamps in UTC (ISO 8601, e.g.
// "2026-06-18T11:00:00Z"). Every user-facing date must be shown in Israel local
// time (Asia/Jerusalem) REGARDLESS of the browser/host timezone — otherwise a
// server or CI box running in UTC displays times a few hours behind (IST is
// UTC+2, IDT is UTC+3). Pinning the timezone here keeps the display correct
// everywhere without touching the stored/backend values.
//
// Display format is DD/MM/YYYY HH:mm (24h, Hebrew-friendly).

export const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';

// Formats an ISO/UTC timestamp as `DD/MM/YYYY HH:mm` in Israel local time.
// Returns an em dash for missing/invalid values so layouts never show raw nulls.
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISRAEL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  // `hour12: false` can yield "24" at midnight in some engines — normalise to 00.
  const hour = get('hour') === '24' ? '00' : get('hour');

  return `${get('day')}/${get('month')}/${get('year')} ${hour}:${get('minute')}`;
}

// The current calendar day in Israel local time as an ISO `YYYY-MM-DD` string —
// the value shape the native <input type="date"> control uses. Computed via the
// Asia/Jerusalem timezone so "today" matches the user's day, not the host's.
export function todayIsoDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}
