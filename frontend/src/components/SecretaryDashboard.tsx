import { useCallback, useEffect, useState } from 'react';
import { getStaffTicketsSummary } from '../services/staff';
import type { TicketsSummary } from '../types';
import { apiErrorMessage } from '../utils/apiErrors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TicketStatusSummary from './TicketStatusSummary';

// The Secretary dashboard (SRS §3 / FR-6): a general ticket-status summary and an
// operational overview. It reads the dedicated GET /api/staff/tickets/summary
// endpoint (Stage 8), which is open to Manager + Secretary and returns accurate
// status totals computed server-side — no more deriving counts from the paginated
// GET /api/tickets list. The Manager-only admin endpoints (employee monitoring,
// performance reports) are out of reach here and intentionally not shown; the
// average completion time card (manager-only) is also omitted.
export default function SecretaryDashboard() {
  const [summary, setSummary] = useState<TicketsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSummary = useCallback(
    () =>
      getStaffTicketsSummary()
        .then(setSummary)
        .catch((err) => setLoadError(apiErrorMessage(err, 'שגיאה בטעינת לוח הבקרה. נסה שוב.')))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetchSummary();
  }, [fetchSummary]);

  if (loading) return <LoadingSpinner message="טוען לוח בקרה..." />;
  if (loadError) return <ErrorMessage message={loadError} onRetry={reload} />;
  if (!summary) return null;

  const pending = summary.total_pending;
  const inProgress = summary.total_in_progress;
  const completed = summary.total_completed;
  const total = pending + inProgress + completed;

  return (
    <div className="flex flex-col gap-8">
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
    </div>
  );
}
