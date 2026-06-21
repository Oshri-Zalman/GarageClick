import { useState, type FormEvent } from 'react';

interface Props {
  // Display name of the user whose password is being reset (for the title).
  userName: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

// Backend minimum (see backend/app/schemas.py — UserUpdate.password).
const PASSWORD_MIN = 6;

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none';

// Reset-temporary-password dialog (FR-6.4 / Stage 9). Sends PATCH
// /api/admin/users/{id} with { password } via the caller. Validates the new
// temporary password (>= 6 chars) before submitting.
export default function ResetPasswordDialog({
  userName,
  submitting,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setValidationError('יש להזין סיסמה זמנית חדשה');
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setValidationError(`הסיסמה חייבת להכיל לפחות ${PASSWORD_MIN} תווים`);
      return;
    }
    setValidationError(null);
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="איפוס סיסמה זמנית"
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-2 text-lg font-bold text-gray-800">איפוס סיסמה זמנית</h2>
        <p className="mb-4 text-sm text-gray-600">
          הגדרת סיסמה זמנית חדשה עבור <span className="font-semibold">{userName}</span>.
        </p>

        <label htmlFor="reset-password" className="mb-1 block text-sm font-semibold text-gray-700">
          סיסמה זמנית חדשה
        </label>
        <input
          id="reset-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass}
        />
        {validationError && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {validationError}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
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
            {submitting ? 'שומר...' : 'אפס סיסמה'}
          </button>
        </div>
      </form>
    </div>
  );
}
