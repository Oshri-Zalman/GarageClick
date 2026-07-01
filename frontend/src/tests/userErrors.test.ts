import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { userErrorMessage } from '../utils/userErrors';

function axiosError(detail: unknown, status?: number): AxiosError {
  const err = new AxiosError('request failed');
  err.response = { data: { detail }, status } as AxiosError['response'];
  return err;
}

describe('userErrorMessage', () => {
  it('maps a duplicate-username conflict to Hebrew', () => {
    expect(userErrorMessage(axiosError('username already exists.', 409), 'fallback')).toBe(
      'שם המשתמש כבר קיים במערכת.'
    );
  });

  it('maps a duplicate-email conflict to Hebrew', () => {
    expect(userErrorMessage(axiosError('email already exists.', 409), 'fallback')).toBe(
      'כתובת האימייל כבר קיימת במערכת.'
    );
  });

  it('maps an invalid-email error to Hebrew', () => {
    expect(
      userErrorMessage(axiosError('email must be a valid email address.', 422), 'fallback')
    ).toBe('יש להזין כתובת אימייל תקינה.');
  });

  it('maps "cannot deactivate your own account" to Hebrew', () => {
    expect(
      userErrorMessage(axiosError('You cannot deactivate your own account.', 400), 'fallback')
    ).toBe('לא ניתן להשבית את המשתמש שלך.');
  });

  it('maps "cannot remove your own Manager role" to Hebrew', () => {
    expect(
      userErrorMessage(axiosError('You cannot remove your own Manager role.', 400), 'fallback')
    ).toBe('לא ניתן להסיר מעצמך הרשאת מנהל.');
  });

  it('maps "user not found" to Hebrew', () => {
    expect(userErrorMessage(axiosError('User not found.', 404), 'fallback')).toBe(
      'המשתמש לא נמצא במערכת.'
    );
  });

  it('maps "cannot delete self" to Hebrew', () => {
    expect(
      userErrorMessage(axiosError('You cannot delete your own account.', 400), 'fallback')
    ).toBe('לא ניתן למחוק את המשתמש שלך.');
  });

  it('maps "referenced by tickets" to a deactivate-instead message', () => {
    expect(
      userErrorMessage(
        axiosError('User is referenced by tickets; deactivate instead.', 409),
        'fallback'
      )
    ).toBe('לא ניתן למחוק משתמש המשויך לכרטיסים. יש להשבית אותו במקום זאת.');
  });

  it('maps a 403 with no known detail to a permissions message', () => {
    expect(userErrorMessage(axiosError('Forbidden', 403), 'fallback')).toBe(
      'אין לך הרשאה לבצע פעולה זו.'
    );
  });

  it('falls back for an unknown error', () => {
    expect(userErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
  });

  it('falls back when detail is a FastAPI validation array (422)', () => {
    expect(userErrorMessage(axiosError([{ msg: 'too short' }], 422), 'fallback')).toBe('fallback');
  });
});
