import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KanbanTicket, TicketStatus, User } from '../types';
import {
  NEXT_STATUS,
  STATUS_FILTER_ACTIVE_STYLES,
  STATUS_LABELS,
  STATUS_ORDER,
} from '../config/ticketStatus';
import { archiveTicket, listTickets, updateTicketStatus } from '../services/tickets';
import { apiErrorMessage } from '../utils/apiErrors';
import KanbanColumn from './KanbanColumn';
import ConfirmDialog from './ConfirmDialog';
import TicketDetailsModal from './TicketDetailsModal';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

type Filter = TicketStatus | 'all';

interface Props {
  user: User;
}

export default function KanbanBoard({ user }: Props) {
  const [tickets, setTickets] = useState<KanbanTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null);
  // The In Progress ticket awaiting an explicit "סיים טיפול" confirmation.
  const [confirming, setConfirming] = useState<KanbanTicket | null>(null);
  // The ticket whose read-only details modal is open (opened by double-click).
  const [detailsId, setDetailsId] = useState<number | null>(null);

  // Fetches tickets and folds the result into state. State is only ever touched
  // asynchronously (inside the promise callbacks), so this is safe to call from
  // an effect without triggering cascading synchronous renders.
  const fetchTickets = useCallback(
    () =>
      listTickets()
        .then(setTickets)
        .catch(() => setError('שגיאה בטעינת הקריאות. נסה שוב.'))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Retry handler (runs in an event context, so synchronous state resets are
  // fine here) — reset the view to loading and fetch again.
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTickets();
  }, [fetchTickets]);

  const isMechanic = user.role === 'Mechanic';

  // A Mechanic may only update tickets assigned to them; Manager/Secretary may
  // update any ticket.
  const canUpdate = useCallback(
    (ticket: KanbanTicket) => !isMechanic || ticket.assigned_mechanic_id === user.id,
    [isMechanic, user.id]
  );

  // Defence-in-depth: even though the API scopes Mechanics to their own
  // tickets, never render someone else's ticket to a Mechanic.
  const visibleTickets = useMemo(
    () => (isMechanic ? tickets.filter((t) => t.assigned_mechanic_id === user.id) : tickets),
    [tickets, isMechanic, user.id]
  );

  const advance = useCallback(
    async (ticket: KanbanTicket, confirmation: boolean) => {
      const next = NEXT_STATUS[ticket.status];
      if (!next) return;
      setUpdatingId(ticket.id);
      setActionError(null);
      try {
        const updated = await updateTicketStatus(ticket.id, next, confirmation);
        setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } catch {
        setActionError('שגיאה בעדכון הסטטוס. נסה שוב.');
      } finally {
        setUpdatingId(null);
      }
    },
    []
  );

  // "קבל" advances immediately; "סיים טיפול" first asks for confirmation.
  const onAdvance = useCallback(
    (ticket: KanbanTicket) => {
      if (ticket.status === 'In Progress') {
        setConfirming(ticket);
      } else {
        advance(ticket, false);
      }
    },
    [advance]
  );

  const confirmComplete = useCallback(() => {
    if (!confirming) return;
    const ticket = confirming;
    setConfirming(null);
    advance(ticket, true);
  }, [confirming, advance]);

  // Close/archive a Completed ticket: it leaves the active board but stays in the
  // DB and history (this is not a delete). On success the ticket is removed from
  // the board; a 409 (not Completed) surfaces a clear Hebrew message.
  const onArchive = useCallback(async (ticket: KanbanTicket) => {
    setArchivingId(ticket.id);
    setActionError(null);
    setArchiveSuccess(null);
    try {
      await archiveTicket(ticket.id);
      setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
      setArchiveSuccess('הכרטיס נסגר ונשמר בהיסטוריה.');
    } catch (err) {
      setActionError(apiErrorMessage(err, 'שגיאה בסגירת הכרטיס. נסה שוב.'));
    } finally {
      setArchivingId(null);
    }
  }, []);

  if (loading) return <LoadingSpinner message="טוען קריאות..." />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  const columns = filter === 'all' ? STATUS_ORDER : [filter];

  return (
    <div>
      <div
        role="group"
        aria-label="סינון לפי סטטוס"
        className="mb-4 flex flex-wrap gap-2"
      >
        <FilterButton value="all" active={filter === 'all'} onClick={() => setFilter('all')}>
          הכל
        </FilterButton>
        {STATUS_ORDER.map((status) => (
          <FilterButton
            key={status}
            value={status}
            active={filter === status}
            onClick={() => setFilter(status)}
          >
            {STATUS_LABELS[status]}
          </FilterButton>
        ))}
      </div>

      {actionError && (
        <div className="mb-4">
          <ErrorMessage message={actionError} />
        </div>
      )}

      {archiveSuccess && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800"
        >
          ✓ {archiveSuccess}
        </div>
      )}

      {visibleTickets.length === 0 ? (
        <p className="py-12 text-center text-gray-500">אין קריאות להצגה</p>
      ) : (
        <div
          className={`grid gap-4 ${
            columns.length === 1 ? 'max-w-md md:grid-cols-1' : 'md:grid-cols-3'
          }`}
        >
          {columns.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tickets={visibleTickets.filter((t) => t.status === status)}
              canUpdate={canUpdate}
              updatingId={updatingId}
              archivingId={archivingId}
              onAdvance={onAdvance}
              onArchive={onArchive}
              onShowDetails={(ticket) => setDetailsId(ticket.id)}
            />
          ))}
        </div>
      )}

      {detailsId != null && (
        <TicketDetailsModal ticketId={detailsId} onClose={() => setDetailsId(null)} />
      )}

      {confirming && (
        <ConfirmDialog
          title="סיום טיפול"
          message="בטוח שרוצה לסיים את הטיפול? לא ניתן לבטל פעולה זו, והלקוח יקבל הודעה אוטומטית."
          confirmLabel="סיים טיפול"
          onConfirm={confirmComplete}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

// Active filter styling matches each status' column/badge colors so the filter
// reads as "the same thing" as the column it selects. "הכל" keeps the neutral
// warm accent.
const ACTIVE_FILTER_STYLES: Record<Filter, string> = {
  all: 'bg-amber-600 text-white border border-amber-600',
  ...STATUS_FILTER_ACTIVE_STYLES,
};

const INACTIVE_FILTER_STYLE =
  'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100';

interface FilterButtonProps {
  value: Filter;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterButton({ value, active, onClick, children }: FilterButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
        (active ? ACTIVE_FILTER_STYLES[value] : INACTIVE_FILTER_STYLE)
      }
    >
      {children}
    </button>
  );
}
