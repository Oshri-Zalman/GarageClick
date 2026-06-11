import { useState, type FormEvent } from 'react';
import type { CustomerSearchType } from '../services/customers';

interface Props {
  searching: boolean;
  onSearch: (type: CustomerSearchType, query: string) => void;
  // Called when the user switches the search type, so the page can clear the
  // results/selection/errors left over from the previous (different-type) search.
  onTypeChange?: () => void;
}

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none';

// RTL search panel (FR-1): pick a search type (phone number / license plate) and
// enter a query. Empty queries are blocked with an inline Hebrew message.
export default function CustomerSearch({ searching, onSearch, onTypeChange }: Props) {
  const [type, setType] = useState<CustomerSearchType>('phone');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Switching the search type starts a fresh search: clear the leftover query and
  // inline error, and let the page drop the previous results/selection/errors.
  const switchType = (next: CustomerSearchType) => {
    if (next === type) return;
    setType(next);
    setQuery('');
    setError(null);
    onTypeChange?.();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setError(type === 'phone' ? 'יש להזין מספר טלפון' : 'יש להזין מספר רכב');
      return;
    }
    setError(null);
    onSearch(type, query.trim());
  };

  const placeholder = type === 'phone' ? 'לדוגמה: 050-1234567' : 'לדוגמה: 12-345-67';

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="חיפוש לקוחות ורכבים"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <fieldset className="mb-3 flex flex-wrap items-center gap-4">
        <legend className="mb-2 font-semibold text-gray-700">חיפוש לפי:</legend>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="search-type"
            value="phone"
            checked={type === 'phone'}
            onChange={() => switchType('phone')}
          />
          מספר טלפון
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="search-type"
            value="license_plate"
            checked={type === 'license_plate'}
            onChange={() => switchType('license_plate')}
          />
          מספר רכב
        </label>
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="customer-search-input" className="sr-only">
            {type === 'phone' ? 'מספר טלפון' : 'מספר רכב'}
          </label>
          <input
            id="customer-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className={fieldClass}
          />
          {error && (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={searching}
          className="rounded-md bg-orange-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
        >
          {searching ? 'מחפש...' : '🔍 חפש'}
        </button>
      </div>
    </form>
  );
}
