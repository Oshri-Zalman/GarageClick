import { useCallback, useEffect, useMemo, useState } from 'react';
import { listTickets } from '../services/tickets';
import type { KanbanTicket } from '../types';
import { apiErrorMessage } from '../utils/apiErrors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TicketStatusSummary from './TicketStatusSummary';

// The Secretary dashboard (SRS §3 / FR-6): a general ticket-status summary and an
// operational overview. The manager-only admin endpoints are out of reach for a
// Secretary (the backend guards them with require_roles("Manager")), so the
// status counts are computed from GET /api/tickets, which a Secretary may read in
// full. No employee monitoring, performance reports, or user-management details
// are shown here.
export default function SecretaryDashboard() {
  const [tickets, setTickets] = useState<KanbanTicket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchTickets = useCallback(
    () =>
      listTickets()
        .then(setTickets)
        .catch((err) => setLoadError(apiErrorMessage(err, 'שגיאה בטעינת הקריאות. נסה שוב.')))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetchTickets();
  }, [fetchTickets]);

  const counts = useMemo(() => {
    const base = { pending: 0, inProgress: 0, completed: 0 };
    if (!tickets) return base;
    for (const t of tickets) {
      if (t.status === 'Pending') base.pending += 1;
      else if (t.status === 'In Progress') base.inProgress += 1;
      else if (t.status === 'Completed') base.completed += 1;
    }
    return base;
  }, [tickets]);

  if (loading) return <LoadingSpinner message="טוען לוח בקרה..." />;
  if (loadError) return <ErrorMessage message={loadError} onRetry={reload} />;

  const total = counts.pending + counts.inProgress + counts.completed;

  return (
    <div className="flex flex-col gap-8">
      <TicketStatusSummary
        pending={counts.pending}
        inProgress={counts.inProgress}
        completed={counts.completed}
      />

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
              מתוכן <span className="font-bold text-gray-800">{counts.pending + counts.inProgress}</span> פעילות.
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
