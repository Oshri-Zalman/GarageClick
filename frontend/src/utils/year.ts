// Vehicle-year helpers, mirroring the backend rule in validators.validate_year:
//   an integer between 1900 and next calendar year (so next year's models are
//   allowed). Shared by the vehicle form so the same Hebrew message is shown
//   before submit and the value the backend accepts is the value sent.

const MIN_YEAR = 1900;

// Allow next year's models, matching validators._max_year().
export function maxYear(): number {
  return new Date().getFullYear() + 1;
}

// Validates a year typed as a string. Returns a Hebrew error message, or null
// when the year is a valid integer in range.
export function validateYear(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'יש להזין שנה';
  }
  const year = Number(trimmed);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > maxYear()) {
    return `שנה חייבת להיות בין ${MIN_YEAR} ל-${maxYear()}`;
  }
  return null;
}
