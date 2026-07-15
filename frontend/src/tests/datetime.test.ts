import { describe, it, expect } from 'vitest';
import { formatDateTime, todayIsoDate } from '../utils/datetime';
import { getDefaultDateRange } from '../utils/dateRange';

describe('formatDateTime', () => {
  it('renders a UTC ISO timestamp in Israel local time (summer, IDT = UTC+3)', () => {
    // The reported bug: a ticket opened at 14:00 Israel time (11:00 UTC) was
    // shown as 11:00. In June, Israel is on IDT (UTC+3), so 11:00Z must display
    // as 14:00 — the correct local time — regardless of the host timezone.
    expect(formatDateTime('2026-06-18T11:00:00Z')).toBe('18/06/2026 14:00');
  });

  it('renders a UTC ISO timestamp in Israel local time (winter, IST = UTC+2)', () => {
    // In January, Israel is on IST (UTC+2), so 09:05Z displays as 11:05.
    expect(formatDateTime('2026-01-18T09:05:00Z')).toBe('18/01/2026 11:05');
  });

  it('formats as DD/MM/YYYY HH:mm with zero padding', () => {
    expect(formatDateTime('2026-03-05T06:07:00Z')).toBe('05/03/2026 08:07');
  });

  it('returns an em dash for missing or invalid values', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('')).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('—');
  });
});

describe('todayIsoDate', () => {
  it('returns the current Israel day as a YYYY-MM-DD string', () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getDefaultDateRange', () => {
  it('defaults to the last week: today minus 6 days → today', () => {
    const { start_date, end_date } = getDefaultDateRange();
    expect(end_date).toBe(todayIsoDate());
    expect(start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Exactly 6 calendar days apart (7 inclusive days).
    const diffDays =
      (Date.parse(`${end_date}T00:00:00Z`) - Date.parse(`${start_date}T00:00:00Z`)) /
      (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(6);
  });
});
