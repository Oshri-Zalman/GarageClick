import { useState, type FormEvent, type ReactNode } from 'react';
import type { CustomerInput, CustomerSummary } from '../types';
import { normalizePhone, validatePhone } from '../utils/phone';

interface Props {
  // When provided, the form edits this customer; otherwise it creates a new one.
  customer?: CustomerSummary;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: CustomerInput) => void;
  onCancel: () => void;
}

interface Errors {
  full_name?: string;
  phone_number?: string;
}

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none';

// Create / edit customer form (FR-1). Validation mirrors the backend: full name
// required, phone required + 9–15 digits (reuses utils/phone).
export default function CustomerForm({ customer, submitting, error, onSubmit, onCancel }: Props) {
  const isEdit = customer !== undefined;
  const [fullName, setFullName] = useState(customer?.full_name ?? '');
  const [phone, setPhone] = useState(customer?.phone_number ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const validate = (): Errors => {
    const errs: Errors = {};
    if (!fullName.trim()) errs.full_name = 'יש להזין שם לקוח';
    const phoneErr = validatePhone(phone);
    if (phoneErr) errs.phone_number = phoneErr;
    return errs;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ full_name: fullName.trim(), phone_number: normalizePhone(phone) });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label={isEdit ? 'עריכת לקוח' : 'לקוח חדש'}>
      <h3 className="text-lg font-bold text-gray-800">{isEdit ? 'עריכת לקוח' : 'לקוח חדש'}</h3>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <Field id="customer-full-name" label="שם מלא" error={errors.full_name}>
          <input
            id="customer-full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field id="customer-phone-number" label="טלפון" error={errors.phone_number}>
          <input
            id="customer-phone-number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldClass}
          />
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
          {submitting ? 'שומר...' : isEdit ? 'שמור שינויים' : 'צור לקוח'}
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
