import { useState, type FormEvent } from 'react';
import type { CreateTicketPayload, Mechanic, User, VehicleSearchHit } from '../types';
import TicketDetailsFields, { type TicketDetailsField } from './TicketDetailsFields';
import PartsSelection from './PartsSelection';
import {
  buildPartsPayload,
  emptyPartsSelection,
  validatePartsSelection,
  type PartsSelectionState,
} from './ticketParts';
import {
  buildDetailsPayload,
  emptyDetails,
  validateDetails,
  type DetailsErrors,
} from './ticketDetails';

interface Props {
  user: User;
  vehicle: VehicleSearchHit;
  mechanics: Mechanic[];
  submitting: boolean;
  onSubmit: (payload: CreateTicketPayload) => void;
}

// Flow A (FR-2): a vehicle was found by plate. The customer/vehicle details are
// shown read-only (auto-filled) and the user only adds the work details.
export default function ExistingVehicleTicketForm({
  user,
  vehicle,
  mechanics,
  submitting,
  onSubmit,
}: Props) {
  const [details, setDetails] = useState(emptyDetails);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [parts, setParts] = useState<PartsSelectionState>(emptyPartsSelection);
  const [partsError, setPartsError] = useState<string | null>(null);

  const onChange = (field: TicketDetailsField, value: string) =>
    setDetails((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateDetails(user, details);
    const partsErr = validatePartsSelection(parts);
    setErrors(found);
    setPartsError(partsErr);
    if (Object.keys(found).length > 0 || partsErr) return;
    onSubmit({
      vehicle_id: vehicle.vehicle_id,
      ...buildDetailsPayload(user, details),
      parts: buildPartsPayload(parts),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div
        className="rounded-xl border border-green-200 bg-green-50 p-4"
        data-testid="existing-vehicle-summary"
      >
        <p className="mb-2 font-semibold text-green-800">✓ הרכב נמצא במערכת</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="מספר רכב" value={vehicle.license_plate} />
          <Detail label="לקוח" value={vehicle.customer_name} />
          <Detail label="טלפון" value={vehicle.customer_phone} />
          <Detail label="יצרן" value={vehicle.manufacturer} />
          <Detail label="דגם" value={vehicle.model} />
          <Detail label="שנה" value={vehicle.year != null ? String(vehicle.year) : '—'} />
        </dl>
      </div>

      <TicketDetailsFields
        user={user}
        mechanics={mechanics}
        values={details}
        errors={errors}
        onChange={onChange}
      />

      <PartsSelection
        manufacturer={vehicle.manufacturer}
        model={vehicle.model}
        year={vehicle.year}
        value={parts}
        onChange={setParts}
        error={partsError}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium text-gray-500">{label}:</dt>
      <dd className="font-semibold text-gray-800">{value}</dd>
    </div>
  );
}
