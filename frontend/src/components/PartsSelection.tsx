import { useEffect, useState } from 'react';
import type { CompatiblePart } from '../types';
import { getCompatibleParts } from '../services/parts';
import { type PartsSelectionState } from './ticketParts';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface Props {
  // The vehicle whose compatible parts to load. In the existing-vehicle flow
  // these are the auto-filled values; in the new-vehicle flow they are what the
  // user typed. Parts are only loaded once all three are known.
  manufacturer: string;
  model: string;
  year: number | null;
  value: PartsSelectionState;
  onChange: (next: PartsSelectionState) => void;
  // Submit-time validation error from the parent form (FR-7.2/7.3).
  error?: string | null;
}

const OUT_OF_STOCK_MESSAGE = 'החלק אינו זמין במלאי';

// Stage 5: compatible parts selection inside the ticket-creation flow. Loads the
// parts that fit the chosen vehicle, lets the user pick available parts (with a
// quantity capped by stock), disables out-of-stock parts, and offers an
// "אחר / ללא חלפים" option for tickets that use no inventory parts.
export default function PartsSelection({
  manufacturer,
  model,
  year,
  value,
  onChange,
  error,
}: Props) {
  // Bumped by the retry button to re-run the load (FR-9).
  const [reloadToken, setReloadToken] = useState(0);

  // Manufacturer + model are enough to load parts. `year` is optional because an
  // existing vehicle may have no recorded year — the backend then matches by
  // manufacturer/model only (NULL part fields still act as wildcards).
  const vehicleKnown = Boolean(manufacturer && model);
  // A stable identity for the current vehicle+retry combo. Drives both the
  // render-phase loading reset and the fetch effect. A missing year collapses to
  // an empty segment so the key stays stable.
  const requestKey = vehicleKnown
    ? `${manufacturer}|${model}|${year ?? ''}|${reloadToken}`
    : null;

  // The load result, tagged with the requestKey it belongs to so a stale
  // response is ignored once the vehicle changes.
  const [result, setResult] = useState<{
    key: string;
    status: 'loading' | 'error' | 'ready';
    parts: CompatiblePart[];
  }>({ key: '', status: 'ready', parts: [] });

  // When the vehicle (or retry token) changes, flip to "loading" for the new key
  // during render — React's supported "adjust state while rendering" pattern,
  // which keeps the effect free of synchronous setState.
  if (requestKey && requestKey !== result.key) {
    setResult({ key: requestKey, status: 'loading', parts: [] });
  }

  useEffect(() => {
    if (!requestKey) return;
    let active = true;
    getCompatibleParts(manufacturer, model, year)
      .then((list) => {
        if (active) setResult({ key: requestKey, status: 'ready', parts: list });
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, status: 'error', parts: [] });
      });
    return () => {
      active = false;
    };
  }, [requestKey, manufacturer, model, year]);

  const loading = result.status === 'loading';
  const loadError =
    result.status === 'error' ? 'שגיאה בטעינת החלפים התואמים. נסה שוב.' : null;
  const parts = result.status === 'ready' ? result.parts : [];

  // Local search over the ALREADY-LOADED compatible parts (no extra request).
  // Case-insensitive substring match on name/code/manufacturer/model, so it
  // works with Hebrew, English (either case) and numbers (e.g. a part code).
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visibleParts = query
    ? parts.filter((p) =>
        [p.part_name, p.part_code, p.manufacturer, p.model].some(
          (field) => field != null && field.toLowerCase().includes(query)
        )
      )
    : parts;

  const togglePart = (part: CompatiblePart, checked: boolean) => {
    const selected = { ...value.selected };
    if (checked) {
      selected[part.id] = 1;
      // Selecting a part clears the search so the user can look up the next one;
      // already-selected parts stay selected (they live in `value.selected`).
      setSearch('');
    } else {
      delete selected[part.id];
    }
    // Picking a real part clears the "אחר / ללא חלפים" choice.
    onChange({ selected, noParts: false });
  };

  const setQuantity = (part: CompatiblePart, quantity: number) => {
    const clamped = Math.max(1, Math.min(quantity, part.quantity_current));
    onChange({ ...value, selected: { ...value.selected, [part.id]: clamped } });
  };

  const toggleNoParts = (checked: boolean) => {
    // "אחר / ללא חלפים" is mutually exclusive with picking parts.
    onChange(checked ? { selected: {}, noParts: true } : { ...value, noParts: false });
  };

  const selectedEntries = Object.entries(value.selected).map(([id, qty]) => {
    const part = parts.find((p) => p.id === Number(id));
    return { id: Number(id), name: part?.part_name ?? `#${id}`, qty };
  });
  const hasSummary = value.noParts || selectedEntries.length > 0;

  return (
    <fieldset className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <legend className="px-2 font-semibold text-amber-800">בחירת חלפים</legend>

      {!vehicleKnown && (
        <p className="text-sm text-gray-500">
          הזן את פרטי הרכב (יצרן ודגם) כדי לטעון חלפים תואמים.
        </p>
      )}

      {vehicleKnown && loading && <LoadingSpinner message="טוען חלפים תואמים..." />}

      {vehicleKnown && !loading && loadError && (
        <ErrorMessage message={loadError} onRetry={() => setReloadToken((t) => t + 1)} />
      )}

      {vehicleKnown && !loading && !loadError && (
        <div className="flex flex-col gap-2">
          {parts.length === 0 && (
            <p className="text-sm text-gray-500" data-testid="no-compatible-parts">
              לא נמצאו חלפים תואמים לרכב זה.
            </p>
          )}

          {parts.length > 0 && (
            <input
              type="search"
              aria-label="חיפוש חלפים"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם, מק״ט או יצרן"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          )}

          {parts.length > 0 && visibleParts.length === 0 && (
            <p className="text-sm text-gray-500" data-testid="no-search-results">
              לא נמצאו חלפים התואמים את החיפוש.
            </p>
          )}

          {visibleParts.map((part) => {
            const isSelected = part.id in value.selected;
            const disabled = !part.available || value.noParts;
            return (
              <div
                key={part.id}
                className="rounded-md border border-amber-100 bg-white px-3 py-2 text-sm"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={part.part_name}
                    checked={isSelected}
                    disabled={disabled}
                    onChange={(e) => togglePart(part, e.target.checked)}
                    className="h-4 w-4 accent-orange-600"
                  />
                  <span className={part.available ? 'text-gray-800' : 'text-gray-400'}>
                    <span className="font-semibold">{part.part_name}</span>{' '}
                    <span className="text-gray-400">({part.part_code})</span> · מלאי:{' '}
                    {part.quantity_current}
                  </span>
                </label>

                {!part.available && (
                  <p className="mt-1 pr-6 text-sm font-medium text-red-600">
                    {OUT_OF_STOCK_MESSAGE}
                  </p>
                )}

                {part.available && isSelected && (
                  <div className="mt-1 flex items-center gap-2 pr-6">
                    <label htmlFor={`qty-${part.id}`} className="text-gray-600">
                      כמות:
                    </label>
                    <select
                      id={`qty-${part.id}`}
                      aria-label={`כמות עבור ${part.part_name}`}
                      value={value.selected[part.id]}
                      onChange={(e) => setQuantity(part, Number(e.target.value))}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none"
                    >
                      {Array.from({ length: part.quantity_current }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* The "אחר / ללא חלפים" option stays available even while parts load or
          fail, so a ticket that needs no parts can always be opened (FR-7.3). */}
      {vehicleKnown && (
        <label className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-amber-300 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            aria-label="אחר / ללא חלפים"
            checked={value.noParts}
            onChange={(e) => toggleNoParts(e.target.checked)}
            className="h-4 w-4 accent-orange-600"
          />
          <span className="font-semibold text-gray-800">אחר / ללא חלפים</span>
        </label>
      )}

      {hasSummary && (
        <div
          className="mt-2 rounded-md bg-white px-3 py-2 text-sm"
          data-testid="selected-parts-summary"
        >
          <p className="mb-1 font-semibold text-amber-800">חלפים שנבחרו:</p>
          {value.noParts ? (
            <p className="text-gray-700">ללא חלפים (אחר)</p>
          ) : (
            <ul className="list-inside list-disc text-gray-700">
              {selectedEntries.map((e) => (
                <li key={e.id}>
                  {e.name} × {e.qty}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
