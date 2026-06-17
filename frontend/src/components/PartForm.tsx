import { useState, type FormEvent, type ReactNode } from 'react';
import type { Part, PartInput } from '../types';
import { validateYear } from '../utils/year';
import ManufacturerModelFields from './ManufacturerModelFields';

interface Props {
  // When provided, the form edits this part; otherwise it creates a new one.
  part?: Part;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: PartInput) => void;
  onCancel: () => void;
}

interface Errors {
  part_name?: string;
  part_code?: string;
  manufacturer?: string;
  model?: string;
  year_start?: string;
  quantity_current?: string;
}

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none';

// Create / edit part form (FR-7.1). Validation is enforced inline before submit:
// name, code, manufacturer, model and year are all required; year reuses the
// shared year rule (utils/year, mirrors the backend); quantity must be a
// non-negative integer.
export default function PartForm({ part, submitting, error, onSubmit, onCancel }: Props) {
  const isEdit = part !== undefined;
  const [partName, setPartName] = useState(part?.part_name ?? '');
  const [partCode, setPartCode] = useState(part?.part_code ?? '');
  const [manufacturer, setManufacturer] = useState(part?.manufacturer ?? '');
  const [model, setModel] = useState(part?.model ?? '');
  const [yearStart, setYearStart] = useState(part?.year_start != null ? String(part.year_start) : '');
  const [quantity, setQuantity] = useState(
    part?.quantity_current != null ? String(part.quantity_current) : ''
  );
  const [errors, setErrors] = useState<Errors>({});

  const validate = (): Errors => {
    const errs: Errors = {};
    if (!partName.trim()) errs.part_name = 'יש להזין שם חלף';
    if (!partCode.trim()) errs.part_code = 'יש להזין מק"ט';
    if (!manufacturer) errs.manufacturer = 'יש לבחור יצרן';
    if (!model.trim()) errs.model = 'יש להזין דגם';
    const yearErr = validateYear(yearStart);
    if (yearErr) errs.year_start = yearErr;

    const qtyTrimmed = quantity.trim();
    if (qtyTrimmed === '') {
      errs.quantity_current = 'יש להזין כמות';
    } else {
      const qty = Number(qtyTrimmed);
      if (!Number.isInteger(qty) || qty < 0) {
        errs.quantity_current = 'הכמות חייבת להיות מספר שלם אי-שלילי';
      }
    }
    return errs;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({
      part_name: partName.trim(),
      part_code: partCode.trim(),
      manufacturer,
      model: model.trim(),
      year_start: Number(yearStart.trim()),
      quantity_current: Number(quantity.trim()),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      aria-label={isEdit ? 'עריכת חלף' : 'חלף חדש'}
    >
      <h3 className="text-lg font-bold text-gray-800">{isEdit ? 'עריכת חלף' : 'חלף חדש'}</h3>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="part-name" label="שם חלף" error={errors.part_name}>
          <input
            id="part-name"
            type="text"
            value={partName}
            onChange={(e) => setPartName(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field id="part-code" label="מק&quot;ט" error={errors.part_code}>
          <input
            id="part-code"
            type="text"
            value={partCode}
            onChange={(e) => setPartCode(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <ManufacturerModelFields
          idPrefix="part"
          fieldClass={fieldClass}
          manufacturer={manufacturer}
          model={model}
          onManufacturerChange={setManufacturer}
          onModelChange={setModel}
          manufacturerError={errors.manufacturer}
          modelError={errors.model}
        />
        <Field id="part-year-start" label="שנת התחלה" error={errors.year_start}>
          <input
            id="part-year-start"
            type="text"
            inputMode="numeric"
            value={yearStart}
            onChange={(e) => setYearStart(e.target.value)}
            placeholder="2015"
            className={fieldClass}
          />
        </Field>
        <Field id="part-quantity" label="כמות במלאי" error={errors.quantity_current}>
          <input
            id="part-quantity"
            type="text"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
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
          {submitting ? 'שומר...' : isEdit ? 'שמור שינויים' : 'צור חלף'}
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
