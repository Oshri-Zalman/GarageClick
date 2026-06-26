import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { apiErrorMessage } from '../utils/apiErrors';

// Builds an AxiosError carrying a backend `detail` payload, like the real client.
function axiosErrorWithDetail(detail: unknown): AxiosError {
  const err = new AxiosError('request failed');
  // Only the `data` field is read by apiErrorMessage.
  err.response = { data: { detail } } as AxiosError['response'];
  return err;
}

const FALLBACK = 'שמירה נכשלה. נסה שוב.';

describe('apiErrorMessage', () => {
  it('maps a duplicate license plate error to Hebrew', () => {
    const err = axiosErrorWithDetail('A vehicle with this license_plate already exists.');
    expect(apiErrorMessage(err, FALLBACK)).toBe('מספר רכב זה כבר קיים במערכת.');
  });

  it('maps the "no fields to update" error to Hebrew', () => {
    const err = axiosErrorWithDetail('Provide at least one field to update.');
    expect(apiErrorMessage(err, FALLBACK)).toBe('יש לעדכן לפחות שדה אחד.');
  });

  it('maps a missing customer error to Hebrew', () => {
    const err = axiosErrorWithDetail('customer_id does not exist.');
    expect(apiErrorMessage(err, FALLBACK)).toBe('הלקוח אינו קיים במערכת.');
  });

  it('maps a duplicate part_code error (409) to Hebrew', () => {
    const err = axiosErrorWithDetail('part_code already exists.');
    expect(apiErrorMessage(err, FALLBACK)).toBe('מק״ט כבר קיים במערכת.');
  });

  it('maps the archive-not-completed error (409) to Hebrew', () => {
    const err = axiosErrorWithDetail('Only a completed ticket can be archived.');
    expect(apiErrorMessage(err, FALLBACK)).toBe('ניתן לסגור רק כרטיסים שהושלמו.');
  });

  it('maps not-found errors to Hebrew', () => {
    expect(apiErrorMessage(axiosErrorWithDetail('Customer not found.'), FALLBACK)).toBe(
      'הלקוח לא נמצא במערכת.'
    );
    expect(apiErrorMessage(axiosErrorWithDetail('Vehicle not found.'), FALLBACK)).toBe(
      'הרכב לא נמצא במערכת.'
    );
  });

  it('maps an incompatible-part ticket error to Hebrew', () => {
    const err = axiosErrorWithDetail(
      'Part "בלמים דיסק קדמי" is not compatible with this vehicle (Volkswagen Golf).'
    );
    expect(apiErrorMessage(err, FALLBACK)).toBe('החלף אינו תואם לרכב זה.');
  });

  it('falls back to the generic Hebrew message for unknown details', () => {
    const err = axiosErrorWithDetail('Some unexpected server error');
    expect(apiErrorMessage(err, FALLBACK)).toBe(FALLBACK);
  });

  it('falls back when detail is a 422 validation array (not a string)', () => {
    const err = axiosErrorWithDetail([{ loc: ['body', 'phone_number'], msg: 'bad' }]);
    expect(apiErrorMessage(err, FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for a non-Axios error', () => {
    expect(apiErrorMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK);
  });
});
