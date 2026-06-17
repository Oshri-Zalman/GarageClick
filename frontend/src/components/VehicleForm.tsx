import { useState, type FormEvent, type ReactNode } from 'react';
import type { CustomerVehicle, VehicleInput } from '../types';
import { normalizePlate, validatePlate } from '../utils/licensePlate';
import { validateYear } from '../utils/year';
import ManufacturerModelFields from './ManufacturerModelFields';

interface Props {
  // When provided, the form edits this vehicle; otherwise it creates a new one
  // for the selected customer.
  vehicle?: CustomerVehicle;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: VehicleInput) => void;
  onCancel: () => void;
}

interface Errors {
  license_plate?: string;
  manufacturer?: string;
  model?: string;
  year?: string;
}

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none';

// Create / edit vehicle form (FR-1). Validation mirrors the backend: plate
// required + normalized (reuses utils/licensePlate), manufacturer + model
// required, year required + in range (reuses utils/year).
export default function VehicleForm({ vehicle, submitting, error, onSubmit, onCancel }: Props) {
  const isEdit = vehicle !== undefined;
  const [plate, setPlate] = useState(vehicle?.license_plate ?? '');
  const [manufacturer, setManufacturer] = useState(vehicle?.manufacturer ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(vehicle?.year != null ? String(vehicle.year) : '');
  const [errors, setErrors] = useState<Errors>({});

  const validate = (): Errors => {
    const errs: Errors = {};
    const plateErr = validatePlate(plate);
    if (plateErr) errs.license_plate = plateErr;
    if (!manufacturer) errs.manufacturer = 'יש לבחור יצרן';
    if (!model.trim()) errs.model = 'יש להזין דגם';
    const yearErr = validateYear(year);
    if (yearErr) errs.year = yearErr;
    return errs;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({
      license_plate: normalizePlate(plate),
      manufacturer,
      model: model.trim(),
      year: Number(year.trim()),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label={isEdit ? 'עריכת רכב' : 'רכב חדש'}>
      <h3 className="text-lg font-bold text-gray-800">{isEdit ? 'עריכת רכב' : 'רכב חדש'}</h3>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="vehicle-license-plate" label="מספר רכב" error={errors.license_plate}>
          <input
            id="vehicle-license-plate"
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <ManufacturerModelFields
          idPrefix="vehicle"
          fieldClass={fieldClass}
          manufacturer={manufacturer}
          model={model}
          onManufacturerChange={setManufacturer}
          onModelChange={setModel}
          manufacturerError={errors.manufacturer}
          modelError={errors.model}
        />
        <Field id="vehicle-year-field" label="שנה" error={errors.year}>
          <input
            id="vehicle-year-field"
            type="text"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2020"
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
          {submitting ? 'שומר...' : isEdit ? 'שמור שינויים' : 'הוסף רכב'}
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
