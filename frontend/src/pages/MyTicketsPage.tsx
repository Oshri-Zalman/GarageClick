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
import {
  buildDateRangeParams,
  getDefaultDateRange,
  validateDateRange,
  type DateRange,
} from '../utils/dateRange';
import MyTicketsFilters from '../components/MyTicketsFilters';
import MyTicketsList from '../components/MyTicketsList';
import DateRangeFilter from '../components/DateRangeFilter';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

// Stage 10 — "ארכיון כרטיסים" ticket archive / history.
//
// Active tickets live on the Work Board (לוח עבודה); this page shows ONLY
// closed/archived tickets (archived_at != null). It fetches with
// archived_only=true so the backend returns just the archive, then scopes the
// result client-side per the chosen view:
//   • Mechanic  — their own archive only.
//   • Secretary — the garage archive (all archived tickets the backend returns).
//   • Manager   — toggles between "הארכיון שלי" (assigned to them) and
//                 "ארכיון המוסך" (all archived tickets).
// An optional date range (by the ticket's open/creation date — that is what the
// backend filters on) narrows the archive server-side. The page is read-only:
// there are no edit/advance/close actions here.
export default function MyTicketsPage() {
  const { user } = useAuth();

  const [tickets, setTickets] = useState<KanbanTicket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  // Draft date inputs vs. the applied range (what the loaded archive reflects).
  // Both default to the last week (today minus 6 days → today) so the archive
  // opens scoped to recent activity and the first request carries start/end.
  const [appliedRange, setAppliedRange] = useState<DateRange>(getDefaultDateRange);
  const [startInput, setStartInput] = useState(() => appliedRange.start_date ?? '');
  const [endInput, setEndInput] = useState(() => appliedRange.end_date ?? '');
  const [rangeError, setRangeError] = useState<string | null>(null);
  // The archive scope currently shown. Initialised to the role's default; only
  // Managers can switch it (they have both scopes available).
  const [scope, setScope] = useState<ArchiveScope>(() =>
    user ? defaultScopeForRole(user.role) : 'mine'
  );

  // Fetches the archive (archived_at != null) and folds it into state. The
  // backend does the archive filtering (archived_only=true), the date-range
  // filtering and Mechanic scoping; filterArchive still applies defensively
  // client-side. State is only touched asynchronously, so this is safe to call
  // from an effect.
  const fetchTickets = useCallback(
    () =>
      listTickets({ archived_only: true, ...appliedRange })
        .then(setTickets)
        .catch(() => setError('שגיאה בטעינת הכרטיסים. נסה שוב.'))
        .finally(() => setLoading(false)),
    [appliedRange]
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

  // Apply the date range. Invalid ranges (start after end) show a Hebrew error
  // and never call the API; a valid range re-fetches via the effect.
  const applyRange = useCallback(() => {
    const err = validateDateRange(startInput, endInput);
    setRangeError(err);
    if (err) return;
    setLoading(true);
    setError(null);
    setAppliedRange(buildDateRangeParams(startInput, endInput));
  }, [startInput, endInput]);

  const availableScopes = user ? scopesForRole(user.role) : [];

  // The archived tickets visible in the currently selected scope.
  const archived = useMemo(
    () => (user && tickets ? filterArchive(tickets, user, scope) : []),
    [tickets, user, scope]
  );

  // Apply the license-plate search within scope (the status filter was removed —
  // the archive holds only closed tickets and is filtered by date instead).
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return archived;
    return archived.filter((ticket) => ticket.license_plate.toLowerCase().includes(query));
  }, [archived, search]);

  if (!user) return null;

  const showTabs = availableScopes.length > 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ארכיון כרטיסים</h1>
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

      <DateRangeFilter
        idPrefix="archive-range"
        start={startInput}
        end={endInput}
        onStartChange={setStartInput}
        onEndChange={setEndInput}
        onApply={applyRange}
        error={rangeError}
      />

      {loading && <LoadingSpinner message="טוען כרטיסים..." />}

      {error && !loading && <ErrorMessage message={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <MyTicketsFilters search={search} onSearchChange={setSearch} />

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
