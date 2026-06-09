import { useState, type FormEvent } from 'react';
import type { CreateTicketPayload, Mechanic, User } from '../types';
import TicketDetailsFields, { type TicketDetailsField } from './TicketDetailsFields';
import {
  buildDetailsPayload,
  emptyDetails,
  validateDetails,
  type DetailsErrors,
} from './ticketDetails';

// Common manufacturers — "selection from a list, not free text" (NFR-4).
const MANUFACTURERS = [
  'Volkswagen',
  'BMW',
  'Toyota',
  'Hyundai',
  'Kia',
  'Mazda',
  'Mercedes-Benz',
  'Skoda',
  'Audi',
  'Ford',
];

interface Props {
  user: User;
  licensePlate: string;
  mechanics: Mechanic[];
  submitting: boolean;
  onSubmit: (payload: CreateTicketPayload) => void;
}

interface VehicleErrors {
  full_name?: string;
  phone_number?: string;
  manufacturer?: string;
  model?: string;
  year?: string;
}

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none';

// Flow B (FR-2): no vehicle matched the plate, so the user creates a new
// customer + vehicle alongside the work details.
export default function NewCustomerVehicleTicketForm({
  user,
  licensePlate,
  mechanics,
  submitting,
  onSubmit,
}: Props) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [details, setDetails] = useState(emptyDetails);
  const [vehicleErrors, setVehicleErrors] = useState<VehicleErrors>({});
  const [detailErrors, setDetailErrors] = useState<DetailsErrors>({});

  const onDetailChange = (field: TicketDetailsField, value: string) =>
    setDetails((prev) => ({ ...prev, [field]: value }));

  const validateVehicle = (): VehicleErrors => {
    const errs: VehicleErrors = {};
    if (!fullName.trim()) errs.full_name = 'יש להזין שם לקוח';

    // Mirror the backend phone rule (validators.clean_phone): strip separators,
    // then require an optional leading + and 9–15 digits.
    if (!phone.trim()) {
      errs.phone_number = 'יש להזין מספר טלפון';
    } else if (!/^\+?\d{9,15}$/.test(phone.replace(/[\s\-().]/g, ''))) {
      errs.phone_number = 'מספר טלפון חייב להכיל 9 עד 15 ספרות';
    }

    if (!manufacturer) errs.manufacturer = 'יש לבחור יצרן';
    if (!model.trim()) errs.model = 'יש להזין דגם';

    // Mirror the backend year rule (validators.validate_year): 1900 .. next year.
    const maxYear = new Date().getFullYear() + 1;
    const yearNum = Number(year.trim());
    if (!year.trim()) {
      errs.year = 'יש להזין שנה';
    } else if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > maxYear) {
      errs.year = `שנה חייבת להיות בין 1900 ל-${maxYear}`;
    }
    return errs;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const vErrs = validateVehicle();
    const dErrs = validateDetails(user, details);
    setVehicleErrors(vErrs);
    setDetailErrors(dErrs);
    if (Object.keys(vErrs).length > 0 || Object.keys(dErrs).length > 0) return;

    onSubmit({
      license_plate: licensePlate,
      new_customer: { full_name: fullName.trim(), phone_number: phone.trim() },
      new_vehicle: {
        manufacturer,
        model: model.trim(),
        year: Number(year.trim()),
      },
      ...buildDetailsPayload(user, details),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        role="status"
      >
        ⚠️ הרכב <span className="font-bold">{licensePlate}</span> לא נמצא במערכת. יש למלא פרטי לקוח ורכב חדשים.
      </div>

      <fieldset className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
        <legend className="px-2 font-semibold text-gray-700">לקוח חדש</legend>
        <Field id="customer-name" label="שם מלא" error={vehicleErrors.full_name}>
          <input
            id="customer-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field id="customer-phone" label="טלפון" error={vehicleErrors.phone_number}>
          <input
            id="customer-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldClass}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
        <legend className="px-2 font-semibold text-gray-700">רכב חדש</legend>
        <Field id="vehicle-plate" label="מספר רכב">
          <input id="vehicle-plate" type="text" value={licensePlate} readOnly className={`${fieldClass} bg-gray-100`} />
        </Field>
        <Field id="vehicle-manufacturer" label="יצרן" error={vehicleErrors.manufacturer}>
          <select
            id="vehicle-manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            className={fieldClass}
          >
            <option value="">בחר יצרן...</option>
            {MANUFACTURERS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field id="vehicle-model" label="דגם" error={vehicleErrors.model}>
          <input
            id="vehicle-model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field id="vehicle-year" label="שנה" error={vehicleErrors.year}>
          <input
            id="vehicle-year"
            type="text"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2020"
            className={fieldClass}
          />
        </Field>
      </fieldset>

      <TicketDetailsFields
        user={user}
        mechanics={mechanics}
        values={details}
        errors={detailErrors}
        onChange={onDetailChange}
      />

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
      >
        {submitting ? 'פותח כרטיס...' : 'פתח כרטיס'}
      </button>
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
  children: React.ReactNode;
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
