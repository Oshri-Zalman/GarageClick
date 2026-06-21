import { useState, type FormEvent } from 'react';

interface Props {
  // Called with ISO date strings (yyyy-mm-dd) when a valid range is applied.
  onApply: (range: { start_date: string; end_date: string }) => void;
}

// Date range control for the tickets-by-day report (Stage 11). Holds its own
// draft state and only emits onApply once both dates are present and the start
// is not after the end. An invalid range shows a Hebrew validation message and
// onApply is NOT called, so the parent never fires a request for an impossible
// range (the backend only supports a range on /admin/tickets/by-day).
export default function ReportsDateRangeFilter({ onApply }: Props) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!startDate || !endDate) {
      setError('יש לבחור תאריך התחלה ותאריך סיום.');
      return;
    }
    if (startDate > endDate) {
      setError('תאריך ההתחלה חייב להיות מוקדם מתאריך הסיום.');
      return;
    }

    setError(null);
    onApply({ start_date: startDate, end_date: endDate });
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="טווח תאריכים לדוח"
      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        מתאריך
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label="מתאריך"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        עד תאריך
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label="עד תאריך"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
      >
        החל
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
