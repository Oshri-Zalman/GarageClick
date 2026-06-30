interface Props {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  // Applies the currently entered range (the caller validates + fetches).
  onApply: () => void;
  // Hebrew validation error to show (e.g. start after end). Null hides it.
  error?: string | null;
  // Optional id prefix so multiple filters on a page keep unique input ids.
  idPrefix?: string;
  // Hebrew heading describing what the range filters (e.g. the archive uses
  // "טווח תאריכים — תאריך פתיחת הכרטיס" to be accurate about the backend field).
  label?: string;
}

// A reusable start/end date-range control built on native <input type="date">
// fields so the user can either type a date or use the browser's calendar
// picker. Kept presentational + controlled: the parent owns the values, runs the
// validation and performs the API call on apply. Hebrew RTL by inheritance.
export default function DateRangeFilter({
  start,
  end,
  onStartChange,
  onEndChange,
  onApply,
  error,
  idPrefix = 'date-range',
  label = 'טווח תאריכים',
}: Props) {
  const startId = `${idPrefix}-start`;
  const endId = `${idPrefix}-end`;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-600">{label}</span>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              מתאריך
              <input
                id={startId}
                type="date"
                value={start}
                max={end || undefined}
                onChange={(e) => onStartChange(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              עד תאריך
              <input
                id={endId}
                type="date"
                value={end}
                min={start || undefined}
                onChange={(e) => onEndChange(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </label>
            <button
              type="button"
              onClick={onApply}
              className="rounded-md bg-orange-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700"
            >
              החל
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
