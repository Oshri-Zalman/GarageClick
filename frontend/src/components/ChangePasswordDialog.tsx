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
// undefined/light color, so typing looked invisible). `pl-10` reserves room on
// the left (RTL end) for the always-visible show/hide eye button.
const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 pl-10 text-sm text-gray-900 focus:border-amber-500 focus:outline-none';

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
            <PasswordField
              id="current-password"
              label="סיסמה נוכחית"
              value={current}
              onChange={setCurrent}
              error={fieldErrors.current}
            />

            <PasswordField
              id="new-password"
              label="סיסמה חדשה"
              value={next}
              onChange={setNext}
              error={fieldErrors.next}
            />

            <PasswordField
              id="confirm-password"
              label="אימות סיסמה חדשה"
              value={confirm}
              onChange={setConfirm}
              error={fieldErrors.confirm}
            />

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

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

// A single password field with an always-visible show/hide eye button. We render
// our own toggle (rather than relying on the browser's built-in reveal control,
// which only appears intermittently) so it is present in every state — empty,
// focused, blurred, hidden or visible. The toggle is type="button" so it never
// submits the form and flips only its own field's masking.
function PasswordField({ id, label, value, onChange, error }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'הסתר סיסמה' : 'הצג סיסמה'}
          aria-pressed={visible}
          title={visible ? 'הסתר סיסמה' : 'הצג סיסמה'}
          className="absolute inset-y-0 left-2 flex items-center text-gray-500 hover:text-gray-700"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// Plain, neutral eye icons (Feather-style inline SVG, currentColor) — no emoji.
// "Eye" = password hidden (click to show); "eye-off" = password visible.
function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
