import { describe, it, expect } from 'vitest';
import {
  INVALID_DATE_RANGE_MESSAGE,
  buildDateRangeParams,
  validateDateRange,
} from '../utils/dateRange';

describe('validateDateRange', () => {
  it('accepts an empty range (both ends unset)', () => {
    expect(validateDateRange('', '')).toBeNull();
  });

  it('accepts an open-ended range (only one end set)', () => {
    expect(validateDateRange('2026-05-01', '')).toBeNull();
    expect(validateDateRange('', '2026-06-02')).toBeNull();
  });

  it('accepts start before end and start equal to end', () => {
    expect(validateDateRange('2026-05-01', '2026-06-02')).toBeNull();
    expect(validateDateRange('2026-05-01', '2026-05-01')).toBeNull();
  });

  it('rejects start after end with a Hebrew message', () => {
    expect(validateDateRange('2026-06-02', '2026-05-01')).toBe(INVALID_DATE_RANGE_MESSAGE);
  });
});

describe('buildDateRangeParams', () => {
  it('omits empty fields', () => {
    expect(buildDateRangeParams('', '')).toEqual({});
    expect(buildDateRangeParams('2026-05-01', '')).toEqual({ start_date: '2026-05-01' });
    expect(buildDateRangeParams('', '2026-06-02')).toEqual({ end_date: '2026-06-02' });
  });

  it('includes both ends when set', () => {
    expect(buildDateRangeParams('2026-05-01', '2026-06-02')).toEqual({
      start_date: '2026-05-01',
      end_date: '2026-06-02',
    });
  });
});
