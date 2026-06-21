import { AxiosError } from 'axios';

// Maps known backend error details for user management (which the API returns in
// English) to clear Hebrew messages for the Manager user-management screen.
// Anything we don't recognise falls back to a safe generic Hebrew message
// supplied by the caller, so the UI never surfaces raw English text.

// Each entry matches on a stable substring of the backend `detail` string
// (see backend/app/routers/admin.py — user management section).
const KNOWN_ERRORS: { match: string; hebrew: string }[] = [
  { match: 'username already exists', hebrew: 'שם המשתמש כבר קיים במערכת.' },
  { match: 'User not found', hebrew: 'המשתמש לא נמצא במערכת.' },
  { match: 'cannot delete your own account', hebrew: 'לא ניתן למחוק את המשתמש שלך.' },
  {
    match: 'referenced by tickets',
    hebrew: 'לא ניתן למחוק משתמש המשויך לכרטיסים. יש להשבית אותו במקום זאת.',
  },
  {
    match: 'referenced by other records',
    hebrew: 'לא ניתן למחוק משתמש המשויך לרשומות אחרות. יש להשבית אותו במקום זאת.',
  },
  { match: 'Provide at least one field', hebrew: 'יש לעדכן לפחות שדה אחד.' },
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

// Returns the HTTP status of an Axios error, if any.
function statusOf(err: unknown): number | undefined {
  return err instanceof AxiosError ? err.response?.status : undefined;
}

// Returns a Hebrew message for a user-management API error: a known mapping when
// the backend detail is recognised, a permissions message on 403, otherwise the
// caller's Hebrew fallback.
export function userErrorMessage(err: unknown, fallback: string): string {
  const detail = detailString(err);
  if (detail) {
    for (const known of KNOWN_ERRORS) {
      if (detail.includes(known.match)) return known.hebrew;
    }
  }
  if (statusOf(err) === 403) {
    return 'אין לך הרשאה לבצע פעולה זו.';
  }
  return fallback;
}
