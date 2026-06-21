import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { KanbanTicket } from '../types';
import { listTickets } from '../services/tickets';
import {
  filterArchive,
  scopesForRole,
  defaultScopeForRole,
  SCOPE_LABELS,
  type ArchiveScope,
} from '../utils/myTickets';
import MyTicketsFilters, { type StatusFilter } from '../components/MyTicketsFilters';
import MyTicketsList from '../components/MyTicketsList';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

// Stage 10 — "ארכיון כרטיסים" ticket archive / history.
//
// Active tickets live on the Work Board (לוח עבודה); this page shows ONLY
// closed/archived tickets (archived_at != null). It fetches with
// include_archived=true and filters client-side per the chosen scope:
//   • Mechanic  — their own archive only.
//   • Secretary — the garage archive (all archived tickets the backend returns).
//   • Manager   — toggles between "הארכיון שלי" (assigned to them) and
//                 "ארכיון המוסך" (all archived tickets).
// The page is read-only: there are no edit/advance/close actions here.
export default function MyTicketsPage() {
  const { user } = useAuth();

  const [tickets, setTickets] = useState<KanbanTicket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // The archive scope currently shown. Initialised to the role's default; only
  // Managers can switch it (they have both scopes available).
  const [scope, setScope] = useState<ArchiveScope>(() =>
    user ? defaultScopeForRole(user.role) : 'mine'
  );

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

  const availableScopes = user ? scopesForRole(user.role) : [];

  // The archived tickets visible in the currently selected scope.
  const archived = useMemo(
    () => (user && tickets ? filterArchive(tickets, user, scope) : []),
    [tickets, user, scope]
  );

  // Apply the search (by license plate) and optional status filter within scope.
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return archived.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (query && !ticket.license_plate.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [archived, search, statusFilter]);

  if (!user) return null;

  const showTabs = availableScopes.length > 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ארכיון כרטיסים</h1>
        <p className="text-sm text-gray-500">
          כרטיסים סגורים שנשמרו בהיסטוריה. כרטיסים פעילים מופיעים בלוח העבודה.
        </p>
      </div>

      {/* Manager-only scope tabs: personal archive vs. garage-wide archive. */}
      {showTabs && (
        <div role="tablist" aria-label="בחירת ארכיון" className="flex flex-wrap gap-2">
          {availableScopes.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (scope === s
                  ? 'bg-amber-600 text-white border border-amber-600'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100')
              }
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>
      )}

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
              אין כרטיסים סגורים בארכיון להצגה.
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
