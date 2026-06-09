import { describe, it, expect } from 'vitest';
import { normalizePlate, validatePlate } from '../utils/licensePlate';

describe('normalizePlate', () => {
  it('trims whitespace and upper-cases the plate', () => {
    expect(normalizePlate('  vw-1234 ')).toBe('VW-1234');
  });

  it('leaves an already-canonical plate unchanged', () => {
    expect(normalizePlate('123-456')).toBe('123-456');
  });
});

describe('validatePlate', () => {
  it('accepts a valid alphanumeric plate', () => {
    expect(validatePlate('VW1234')).toBeNull();
  });

  it('accepts a valid hyphenated plate', () => {
    expect(validatePlate('123-45-678')).toBeNull();
  });

  it('accepts a lowercase plate (normalized before validation)', () => {
    expect(validatePlate('vw-1234')).toBeNull();
  });

  it('rejects an empty plate as required', () => {
    expect(validatePlate('   ')).toBe('יש להזין מספר רכב');
  });

  it('rejects invalid characters', () => {
    expect(validatePlate('12/34*5')).toBe(
      'מספר רכב יכול להכיל אותיות, ספרות ומקפים בודדים בלבד'
    );
  });

  it('rejects malformed dash usage (double dash)', () => {
    expect(validatePlate('12--34')).toBe(
      'מספר רכב יכול להכיל אותיות, ספרות ומקפים בודדים בלבד'
    );
  });

  it('rejects a leading dash', () => {
    expect(validatePlate('-1234')).toBe(
      'מספר רכב יכול להכיל אותיות, ספרות ומקפים בודדים בלבד'
    );
  });

  it('rejects a trailing dash', () => {
    expect(validatePlate('1234-')).toBe(
      'מספר רכב יכול להכיל אותיות, ספרות ומקפים בודדים בלבד'
    );
  });

  it('rejects a too-short plate (fewer than 4 alphanumerics)', () => {
    expect(validatePlate('12')).toBe('מספר רכב חייב להכיל בין 4 ל-10 אותיות או ספרות');
  });

  it('rejects a too-long plate (more than 10 alphanumerics)', () => {
    expect(validatePlate('12345678901')).toBe(
      'מספר רכב חייב להכיל בין 4 ל-10 אותיות או ספרות'
    );
  });
});
