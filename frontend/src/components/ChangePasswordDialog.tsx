import { useState, type FormEvent } from 'react';
import { changePassword } from '../services/auth';
import { changePasswordErrorMessage } from '../utils/passwordErrors';

interface Props {
  onClose: () => void;
}

// Backend minimum for the new password (see backend/app/routers/auth.py —
// change-password / UserUpdate.password, currently 6).
const PASSWORD_MIN = 6;

// `text-gray-900` keeps the typed value — including the masked password
// bullets/dots — dark and clearly visible (without it the text inherits an
// undefined/light color, so typing looked invisible).
const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none';

interface FieldErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

// Self-service "change password" dialog (POST /api/auth/change-password),
// available to every authenticated role. Validates the three fields client-side
// before calling the API, then maps backend errors to Hebrew. On success the user
// stays signed in (the existing session token remains valid).
export default function ChangePasswordDialog({ onClose }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!current) {
      errors.current = 'יש להזין את הסיסמה הנוכחית';
    }
    if (!next) {
      errors.next = 'יש להזין סיסמה חדשה';
    } else if (next.length < PASSWORD_MIN) {
      errors.next = `הסיסמה חייבת להכיל לפחות ${PASSWORD_MIN} תווים`;
    }
    if (!confirm) {
      errors.confirm = 'יש לאמת את הסיסמה החדשה';
    } else if (next && next !== confirm) {
      errors.confirm = 'הסיסמאות אינן תואמות';
    }
    return errors;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await changePassword(current, next);
      setSuccess(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setApiError(changePasswordErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="החלפת סיסמה"
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-bold text-gray-800">החלפת סיסמה</h2>

        {success ? (
          <>
            <p role="status" className="mb-6 text-sm font-semibold text-green-700">
              הסיסמה עודכנה בהצלחה.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
              >
                סגור
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3">
              <label
                htmlFor="current-password"
                className="mb-1 block text-sm font-semibold text-gray-700"
              >
                סיסמה נוכחית
              </label>
              <input
                id="current-password"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={fieldClass}
              />
              {fieldErrors.current && (
                <p role="alert" className="mt-1 text-sm text-red-600">
                  {fieldErrors.current}
                </p>
              )}
            </div>

            <div className="mb-3">
              <label
                htmlFor="new-password"
                className="mb-1 block text-sm font-semibold text-gray-700"
              >
                סיסמה חדשה
              </label>
              <input
                id="new-password"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className={fieldClass}
              />
              {fieldErrors.next && (
                <p role="alert" className="mt-1 text-sm text-red-600">
                  {fieldErrors.next}
                </p>
              )}
            </div>

            <div className="mb-3">
              <label
                htmlFor="confirm-password"
                className="mb-1 block text-sm font-semibold text-gray-700"
              >
                אימות סיסמה חדשה
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={fieldClass}
              />
              {fieldErrors.confirm && (
                <p role="alert" className="mt-1 text-sm text-red-600">
                  {fieldErrors.confirm}
                </p>
              )}
            </div>

            {apiError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {apiError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {submitting ? 'שומר...' : 'עדכן סיסמה'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
