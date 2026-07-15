import { AxiosError } from 'axios';

// Maps a failed login attempt to a safe Hebrew message. A rejected login must
// never crash the page — the form stays visible and the user can retry.
//
//   • Bad username/password (the backend rejects the credentials with 401, and
//     400/422 for a malformed/empty submission) → a clear credentials message.
//   • Anything else (network failure, 5xx, unexpected shape) → a generic Hebrew
//     fallback, so raw English/technical errors never reach the user.

export const INVALID_CREDENTIALS_MESSAGE = 'שם משתמש או סיסמה לא נכונים';
export const GENERIC_LOGIN_ERROR_MESSAGE = 'אירעה שגיאה בהתחברות. נסה שוב מאוחר יותר.';

export function loginErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    if (status === 401 || status === 400 || status === 422) {
      return INVALID_CREDENTIALS_MESSAGE;
    }
  }
  return GENERIC_LOGIN_ERROR_MESSAGE;
}
