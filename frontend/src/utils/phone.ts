// Phone helpers, mirroring the backend rule in validators.clean_phone:
//   strip separators (spaces, dashes, parentheses, dots), then require an
//   optional leading + followed by 9–15 digits. The frontend normalizes to the
//   same canonical (separator-stripped) form the backend stores, so a number
//   typed with any formatting matches, and validates the same shape so malformed
//   input is caught before search/submit. Shared by the customer forms and the
//   phone-number customer search.

// Separators stripped before validation/storage — mirrors _PHONE_SEPARATORS.
const PHONE_SEPARATORS = /[\s\-().]/g;

// Optional leading +, then 9–15 digits — mirrors _PHONE_RE.
const PHONE_SHAPE = /^\+?\d{9,15}$/;

// Canonical form sent to the API / used for comparison: separators removed.
export function normalizePhone(raw: string): string {
  return raw.replace(PHONE_SEPARATORS, '').trim();
}

// Validates the normalized phone. Returns a Hebrew error message, or null when
// the phone is valid.
export function validatePhone(raw: string): string | null {
  if (!raw.trim()) {
    return 'יש להזין מספר טלפון';
  }
  if (!PHONE_SHAPE.test(normalizePhone(raw))) {
    return 'מספר טלפון חייב להכיל 9 עד 15 ספרות (ניתן להוסיף + בהתחלה)';
  }
  return null;
}
