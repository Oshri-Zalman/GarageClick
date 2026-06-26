import { AxiosError } from 'axios';

// Maps known backend error details from POST /api/auth/change-password (which the
// API returns in English) to clear Hebrew messages for the self-service password
// change dialog. Anything we don't recognise falls back to a safe generic Hebrew
// message, so the UI never surfaces raw English text.

// Each entry matches on a stable substring of the backend `detail` string
// (see backend/app/routers/auth.py — change-password section).
const KNOWN_ERRORS: { match: string; hebrew: string }[] = [
  { match: 'Current password is incorrect', hebrew: 'הסיסמה הנוכחית אינה נכונה.' },
  { match: 'User not found', hebrew: 'המשתמש לא נמצא במערכת.' },
];

// Safe generic fallback shown when no specific mapping applies.
const GENERIC = 'אירעה שגיאה בעת עדכון הסיסמה. נסה שוב.';

// Extracts the backend `detail` string from an Axios error, if present. FastAPI
// validation errors (422) return `detail` as an array, not a string — those are
// ignored here and handled by the generic fallback (the form validates first).
function detailString(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return undefined;
}

function statusOf(err: unknown): number | undefined {
  return err instanceof AxiosError ? err.response?.status : undefined;
}

// Returns a Hebrew message for a change-password API error: a known mapping when
// the backend detail is recognised, a re-login prompt on 401, otherwise a safe
// generic Hebrew fallback.
export function changePasswordErrorMessage(err: unknown): string {
  const detail = detailString(err);
  if (detail) {
    for (const known of KNOWN_ERRORS) {
      if (detail.includes(known.match)) return known.hebrew;
    }
  }
  if (statusOf(err) === 401) {
    return 'יש להתחבר מחדש כדי לבצע פעולה זו.';
  }
  return GENERIC;
}
