import type { CustomerVehicle } from '../types';

interface Props {
  vehicles: CustomerVehicle[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (vehicle: CustomerVehicle) => void;
}

// Renders the selected customer's vehicles (FR-1). When the role may manage
// customers, each row exposes an edit action and the header an "add vehicle"
// action.
export default function VehicleList({ vehicles, canManage, onAdd, onEdit }: Props) {
  return (
    <section aria-label="רכבי הלקוח" className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">רכבים</h3>
        {canManage && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-md border border-orange-300 px-3 py-1.5 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50"
          >
            ➕ הוסף רכב
          </button>
        )}
      </div>

      {vehicles.length === 0 ? (
        <p className="text-sm text-gray-500">אין רכבים רשומים ללקוח זה.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {vehicles.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
            >
              <div className="text-sm">
                <span className="font-bold text-gray-800">{v.license_plate}</span>
                <span className="text-gray-600">
                  {' '}
                  · {v.manufacturer} {v.model}
                  {v.year != null ? ` · ${v.year}` : ''}
                </span>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onEdit(v)}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  aria-label={`ערוך רכב ${v.license_plate}`}
                >
                  ✏️ ערוך
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
