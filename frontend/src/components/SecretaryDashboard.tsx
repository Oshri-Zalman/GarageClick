import { useCallback, useEffect, useState } from 'react';
import { getStaffTicketsSummary } from '../services/staff';
import type { TicketsSummary } from '../types';
import { apiErrorMessage } from '../utils/apiErrors';
import {
  buildDateRangeParams,
  validateDateRange,
  type DateRange,
} from '../utils/dateRange';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import DateRangeFilter from './DateRangeFilter';
import TicketStatusSummary from './TicketStatusSummary';

// The Secretary dashboard (SRS §3 / FR-6): a general ticket-status summary and an
// operational overview. It reads the dedicated GET /api/staff/tickets/summary
// endpoint (Stage 8), which is open to Manager + Secretary and returns accurate
// status totals computed server-side — no more deriving counts from the paginated
// GET /api/tickets list. A date-range filter scopes the summary. The manager-only
// admin endpoints (employee monitoring, performance) are out of reach here, and
// the average completion time is not displayed (product decision).
export default function SecretaryDashboard() {
  const [summary, setSummary] = useState<TicketsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [appliedRange, setAppliedRange] = useState<DateRange>({});
  const [rangeError, setRangeError] = useState<string | null>(null);

  const fetchSummary = useCallback(
    () =>
      getStaffTicketsSummary(appliedRange)
        .then(setSummary)
        .catch((err) => setLoadError(apiErrorMessage(err, 'שגיאה בטעינת לוח הבקרה. נסה שוב.')))
        .finally(() => setLoading(false)),
    [appliedRange]
  );

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetchSummary();
  }, [fetchSummary]);

  // Apply the date range. Invalid ranges (start after end) show a Hebrew error
  // and never trigger an API call.
  const applyRange = useCallback(() => {
    const err = validateDateRange(startInput, endInput);
    setRangeError(err);
    if (err) return;
    setLoading(true);
    setLoadError(null);
    setAppliedRange(buildDateRangeParams(startInput, endInput));
  }, [startInput, endInput]);

  const pending = summary?.total_pending ?? 0;
  const inProgress = summary?.total_in_progress ?? 0;
  const completed = summary?.total_completed ?? 0;
  const total = pending + inProgress + completed;

  return (
    <div className="flex flex-col gap-8">
      <DateRangeFilter
        idPrefix="secretary-dashboard-range"
        start={startInput}
        end={endInput}
        onStartChange={setStartInput}
        onEndChange={setEndInput}
        onApply={applyRange}
        error={rangeError}
      />

      {loading ? (
        <LoadingSpinner message="טוען לוח בקרה..." />
      ) : loadError ? (
        <ErrorMessage message={loadError} onRetry={reload} />
      ) : summary ? (
        <>
          <TicketStatusSummary pending={pending} inProgress={inProgress} completed={completed} />

          <section className="flex flex-col gap-3" aria-label="סקירה תפעולית">
            <h2 className="text-lg font-bold text-gray-800">סקירה תפעולית</h2>
            {total === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                אין כרגע קריאות במערכת.
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
                <p>
                  סך הכל <span className="font-bold text-gray-800">{total}</span> קריאות במערכת,
                  מתוכן <span className="font-bold text-gray-800">{pending + inProgress}</span> פעילות.
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  למעקב וניהול הקריאות עברו אל לוח העבודה.
                </p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
