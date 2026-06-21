import { useState, type FormEvent, type ReactNode } from 'react';
import type { CreateUserInput, ManagedUser, Role, UpdateUserInput } from '../types';
import { ROLE_LABELS } from '../config/roles';

interface Props {
  // When provided, the form edits this user; otherwise it creates a new one.
  user?: ManagedUser;
  submitting: boolean;
  error?: string | null;
  onCreate: (input: CreateUserInput) => void;
  onUpdate: (input: UpdateUserInput) => void;
  onCancel: () => void;
}

interface Errors {
  username?: string;
  password?: string;
  full_name?: string;
  role?: string;
}

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none';

// Backend minimums (see backend/app/schemas.py — UserCreate/UserUpdate).
const USERNAME_MIN = 3;
const PASSWORD_MIN = 6;

const ROLES: Role[] = ['Manager', 'Secretary', 'Mechanic'];

// Create / edit user form (FR-6.4 / Stage 9). On create it collects username,
// temporary password, full name and role. On edit the username is immutable
// (the backend PATCH has no username field) and the password is changed through
// the separate reset-password dialog, so only full name and role are editable.
// Validation mirrors the backend: username >= 3 chars, password >= 6 chars.
export default function UserForm({ user, submitting, error, onCreate, onUpdate, onCancel }: Props) {
  const isEdit = user !== undefined;
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'Mechanic');
  const [errors, setErrors] = useState<Errors>({});

  const validate = (): Errors => {
    const errs: Errors = {};
    if (!isEdit) {
      if (!username.trim()) errs.username = 'יש להזין שם משתמש';
      else if (username.trim().length < USERNAME_MIN)
        errs.username = `שם המשתמש חייב להכיל לפחות ${USERNAME_MIN} תווים`;
      if (!password) errs.password = 'יש להזין סיסמה זמנית';
      else if (password.length < PASSWORD_MIN)
        errs.password = `הסיסמה חייבת להכיל לפחות ${PASSWORD_MIN} תווים`;
    }
    if (!fullName.trim()) errs.full_name = 'יש להזין שם מלא';
    if (!ROLES.includes(role)) errs.role = 'יש לבחור תפקיד';
    return errs;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (isEdit) {
      onUpdate({ full_name: fullName.trim(), role });
    } else {
      onCreate({
        username: username.trim(),
        password,
        full_name: fullName.trim(),
        role,
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      aria-label={isEdit ? 'עריכת משתמש' : 'משתמש חדש'}
    >
      <h3 className="text-lg font-bold text-gray-800">{isEdit ? 'עריכת משתמש' : 'משתמש חדש'}</h3>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <Field id="user-username" label="שם משתמש" error={errors.username}>
          {isEdit ? (
            <input
              id="user-username"
              type="text"
              value={username}
              disabled
              className={`${fieldClass} bg-gray-100 text-gray-500`}
            />
          ) : (
            <input
              id="user-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={fieldClass}
            />
          )}
        </Field>

        {!isEdit && (
          <Field id="user-password" label="סיסמה זמנית" error={errors.password}>
            <input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
            />
          </Field>
        )}

        <Field id="user-full-name" label="שם מלא" error={errors.full_name}>
          <input
            id="user-full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={fieldClass}
          />
        </Field>

        <Field id="user-role" label="תפקיד" error={errors.role}>
          <select
            id="user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={fieldClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-orange-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
        >
          {submitting ? 'שומר...' : isEdit ? 'שמור שינויים' : 'צור משתמש'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
