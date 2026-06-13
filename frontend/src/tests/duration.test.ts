import { describe, it, expect } from 'vitest';
import { formatMinutes, DURATION_UNAVAILABLE } from '../utils/duration';

describe('formatMinutes', () => {
  it('returns the Hebrew placeholder for null/undefined/NaN', () => {
    expect(formatMinutes(null)).toBe(DURATION_UNAVAILABLE);
    expect(formatMinutes(undefined)).toBe(DURATION_UNAVAILABLE);
    expect(formatMinutes(Number.NaN)).toBe(DURATION_UNAVAILABLE);
  });

  it('formats minutes-only durations', () => {
    expect(formatMinutes(45)).toBe('45 דקות');
    expect(formatMinutes(0)).toBe('0 דקות');
  });

  it('formats whole-hour durations', () => {
    expect(formatMinutes(60)).toBe('שעה');
    expect(formatMinutes(120)).toBe('שעתיים');
    expect(formatMinutes(240)).toBe('4 שעות');
  });

  it('formats hours-and-minutes durations', () => {
    expect(formatMinutes(270)).toBe('4 שעות ו-30 דקות');
    expect(formatMinutes(75)).toBe('שעה ו-15 דקות');
  });
});
