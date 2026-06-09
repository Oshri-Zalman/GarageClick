import { useState, type FormEvent } from 'react';
import { normalizePlate, validatePlate } from '../utils/licensePlate';

interface Props {
  // Fired with the normalized (trimmed + upper-cased) plate when the user
  // submits a valid search.
  onSearch: (licensePlate: string) => void;
  // True while the parent is performing the lookup.
  loading: boolean;
}

// Step 1 of the new-ticket flow (FR-2): the user enters a license plate and the
// parent looks it up. Validates and normalizes the plate to the backend's
// canonical form before ever calling the API.
export default function LicensePlateSearch({ onSearch, loading }: Props) {
  const [plate, setPlate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationError = validatePlate(plate);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSearch(normalizePlate(plate));
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <label htmlFor="license-plate" className="mb-2 block text-sm font-semibold text-gray-700">
        מספר רכב
      </label>
      <div className="flex flex-wrap items-start gap-3">
        <input
          id="license-plate"
          type="text"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          disabled={loading}
          placeholder="לדוגמה: 123-45-678"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? 'מחפש...' : '🔍 חפש'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
