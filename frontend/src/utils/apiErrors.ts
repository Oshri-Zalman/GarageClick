import { AxiosError } from 'axios';

// Maps known backend error details (which the API returns in English) to clear
// Hebrew messages for the customer/vehicle management screen. Anything we don't
// recognise falls back to a safe generic Hebrew message supplied by the caller,
// so the UI never surfaces raw English text.

// Each entry matches on a stable substring of the backend `detail` string
// (see backend/app/routers/customers.py and vehicles.py).
const KNOWN_ERRORS: { match: string; hebrew: string }[] = [
  { match: 'license_plate already exists', hebrew: 'מספר רכב זה כבר קיים במערכת.' },
  { match: 'part_code already exists', hebrew: 'מק״ט כבר קיים במערכת.' },
  { match: 'Provide at least one field', hebrew: 'יש לעדכן לפחות שדה אחד.' },
  { match: 'customer_id does not exist', hebrew: 'הלקוח אינו קיים במערכת.' },
  { match: 'Customer not found', hebrew: 'הלקוח לא נמצא במערכת.' },
  { match: 'Vehicle not found', hebrew: 'הרכב לא נמצא במערכת.' },
  { match: 'Part not found', hebrew: 'החלף לא נמצא במערכת.' },
  // Ticket archiving (Stage 8): only Completed tickets can be closed/archived.
  { match: 'Only a completed ticket can be archived', hebrew: 'ניתן לסגור רק כרטיסים שהושלמו.' },
  { match: 'Ticket is already archived', hebrew: 'הכרטיס כבר נסגר.' },
];

// Extracts the backend `detail` string from an Axios error, if present. FastAPI
// validation errors (422) return `detail` as an array, not a string — those are
// ignored here and handled by the generic fallback (the forms validate first).
function detailString(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return undefined;
}

// Returns a Hebrew message for a customer/vehicle API error: a known mapping when
// the backend detail is recognised, otherwise the caller's Hebrew fallback.
export function apiErrorMessage(err: unknown, fallback: string): string {
  const detail = detailString(err);
  if (detail) {
    for (const known of KNOWN_ERRORS) {
      if (detail.includes(known.match)) return known.hebrew;
    }
  }
  return fallback;
}
