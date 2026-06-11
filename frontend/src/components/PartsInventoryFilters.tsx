import { EMPTY_FILTERS, type PartFilters } from './partsFilters';

interface Props {
  filters: PartFilters;
  onChange: (filters: PartFilters) => void;
}

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none';

// Client-side search/filter controls for the inventory list (FR-7). All four
// fields are case-insensitive substring matches applied by the page; the backend
// /inventory endpoint has no filter params, so filtering happens on the client.
export default function PartsInventoryFilters({ filters, onChange }: Props) {
  const set = (key: keyof PartFilters) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...filters, [key]: e.target.value });

  const hasAny = Object.values(filters).some((v) => v.trim() !== '');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="filter-part-name" label="שם חלף">
          <input
            id="filter-part-name"
            type="text"
            value={filters.partName}
            onChange={set('partName')}
            placeholder="חיפוש לפי שם"
            className={fieldClass}
          />
        </Field>
        <Field id="filter-part-code" label="מק&quot;ט">
          <input
            id="filter-part-code"
            type="text"
            value={filters.partCode}
            onChange={set('partCode')}
            placeholder="חיפוש לפי מק&quot;ט"
            className={fieldClass}
          />
        </Field>
        <Field id="filter-manufacturer" label="יצרן">
          <input
            id="filter-manufacturer"
            type="text"
            value={filters.manufacturer}
            onChange={set('manufacturer')}
            placeholder="חיפוש לפי יצרן"
            className={fieldClass}
          />
        </Field>
        <Field id="filter-model" label="דגם">
          <input
            id="filter-model"
            type="text"
            value={filters.model}
            onChange={set('model')}
            placeholder="חיפוש לפי דגם"
            className={fieldClass}
          />
        </Field>
      </div>

      {hasAny && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800"
        >
          נקה סינון
        </button>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}
