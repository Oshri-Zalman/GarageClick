// License-plate helpers, mirroring the backend rule in validators.clean_license_plate:
//   4–10 letters/digits, optional single dashes between groups, upper-cased on save.
// The frontend normalizes to the same canonical (trimmed + upper-cased) form so a
// plate typed in any case matches the value the backend stores, and validates the
// same shape so malformed input is caught before search/submit. Letters are
// allowed — the backend accepts alphanumeric plates, not Israeli numeric-only.

// Groups of letters/digits joined by single dashes (no leading/trailing/double
// dashes). Applied to the already-upper-cased value.
const PLATE_SHAPE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

// Canonical form sent to the API: trimmed and upper-cased.
export function normalizePlate(raw: string): string {
  return raw.trim().toUpperCase();
}

// Validates the normalized plate. Returns a Hebrew error message, or null when
// the plate is valid.
export function validatePlate(raw: string): string | null {
  const plate = normalizePlate(raw);
  if (!plate) {
    return 'יש להזין מספר רכב';
  }
  if (!PLATE_SHAPE.test(plate)) {
    return 'מספר רכב יכול להכיל אותיות, ספרות ומקפים בודדים בלבד';
  }
  const alphanumeric = plate.replace(/-/g, '');
  if (alphanumeric.length < 4 || alphanumeric.length > 10) {
    return 'מספר רכב חייב להכיל בין 4 ל-10 אותיות או ספרות';
  }
  return null;
}
