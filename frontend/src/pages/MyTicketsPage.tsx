import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { KanbanTicket } from '../types';
import { listTickets } from '../services/tickets';
import { filterArchivedForUser } from '../utils/myTickets';
import MyTicketsFilters, { type StatusFilter } from '../components/MyTicketsFilters';
import MyTicketsList from '../components/MyTicketsList';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

// Stage 10 — "הכרטיסים שלי" personal ticket history/archive.
//
// Active tickets already live on the Work Board (לוח עבודה), so this page shows
// ONLY closed/archived tickets (archived_at != null). It fetches with
// include_archived=true and then filters client-side, both to the archived set
// and to the tickets the current user owns/was assigned (see filterArchivedForUser).
// The page is read-only: there are no edit/advance/close actions here.
export default function MyTicketsPage() {
  const { user } = useAuth();

  const [tickets, setTickets] = useState<KanbanTicket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetches the full list (including archived) and folds it into state. State is
  // only touched asynchronously, so this is safe to call from an effect.
  const fetchTickets = useCallback(
    () =>
      listTickets({ include_archived: true })
        .then(setTickets)
        .catch(() => setError('שגיאה בטעינת הכרטיסים. נסה שוב.'))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Retry handler (event context, so synchronous resets are fine here).
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTickets();
  }, [fetchTickets]);

  // Only the closed/archived tickets that belong to the current user.
  const archived = useMemo(
    () => (user && tickets ? filterArchivedForUser(tickets, user) : []),
    [tickets, user]
  );

  // Apply the search (by license plate) and optional status filter.
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return archived.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (query && !ticket.license_plate.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [archived, search, statusFilter]);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">הכרטיסים שלי</h1>
        <p className="text-sm text-gray-500">
          כרטיסים שנסגרו ונשמרו בהיסטוריה. כרטיסים פעילים מופיעים בלוח העבודה.
        </p>
      </div>

      {loading && <LoadingSpinner message="טוען כרטיסים..." />}

      {error && !loading && <ErrorMessage message={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <MyTicketsFilters
            search={search}
            onSearchChange={setSearch}
            status={statusFilter}
            onStatusChange={setStatusFilter}
          />

          {archived.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              עדיין אין כרטיסים סגורים בהיסטוריה שלך.
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              לא נמצאו כרטיסים התואמים את החיפוש.
            </div>
          ) : (
            <MyTicketsList tickets={visible} />
          )}
        </>
      )}
    </div>
  );
}
