import { describe, it, expect } from 'vitest';
import { normalizePhone, validatePhone } from '../utils/phone';
import { validateYear, maxYear } from '../utils/year';
import { normalizePlate, validatePlate } from '../utils/licensePlate';

// These mirror the backend validators (validators.clean_phone / validate_year /
// clean_license_plate) and are reused by the customer/vehicle forms, so the same
// shapes the API accepts pass and the same Hebrew messages are shown.

describe('phone validation (utils/phone)', () => {
  it('strips separators when normalizing', () => {
    expect(normalizePhone('050-123-4567')).toBe('0501234567');
    expect(normalizePhone('(050) 123 4567')).toBe('0501234567');
    expect(normalizePhone('+972-50-1234567')).toBe('+972501234567');
  });

  it('requires a phone number', () => {
    expect(validatePhone('')).toBe('יש להזין מספר טלפון');
    expect(validatePhone('   ')).toBe('יש להזין מספר טלפון');
  });

  it('accepts 9–15 digits with an optional leading +', () => {
    expect(validatePhone('050-123-4567')).toBeNull();
    expect(validatePhone('+972501234567')).toBeNull();
  });

  it('rejects too-short / non-numeric phones', () => {
    expect(validatePhone('12345')).not.toBeNull();
    expect(validatePhone('abcdefghij')).not.toBeNull();
  });
});

describe('year validation (utils/year)', () => {
  it('requires a year', () => {
    expect(validateYear('')).toBe('יש להזין שנה');
  });

  it('accepts a year between 1900 and next year', () => {
    expect(validateYear('2018')).toBeNull();
    expect(validateYear('1900')).toBeNull();
    expect(validateYear(String(maxYear()))).toBeNull();
  });

  it('rejects out-of-range or non-integer years', () => {
    expect(validateYear('1899')).not.toBeNull();
    expect(validateYear(String(maxYear() + 1))).not.toBeNull();
    expect(validateYear('20ab')).not.toBeNull();
  });
});

describe('license plate validation (utils/licensePlate)', () => {
  it('normalizes to trimmed upper-case', () => {
    expect(normalizePlate('  vw-1234 ')).toBe('VW-1234');
  });

  it('accepts 4–10 alphanumerics with optional dashes', () => {
    expect(validatePlate('12-345-67')).toBeNull();
    expect(validatePlate('VW1234')).toBeNull();
  });

  it('rejects too-short or malformed plates', () => {
    expect(validatePlate('12')).not.toBeNull();
    expect(validatePlate('-123-')).not.toBeNull();
  });
});
