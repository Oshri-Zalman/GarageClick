import type { KanbanTicket } from '../types';
import { ACTION_LABELS } from '../config/ticketStatus';
import StatusBadge from './StatusBadge';

interface Props {
  ticket: KanbanTicket;
  // Whether the current user is allowed to advance/close this ticket. Mechanics
  // may only act on tickets assigned to them.
  canUpdate: boolean;
  // Whether a status update for this ticket is currently in flight.
  updating: boolean;
  // Whether an archive (close) request for this ticket is currently in flight.
  archiving: boolean;
  onAdvance: () => void;
  // Close/archive a Completed ticket — keeps it in history, removes it from the
  // active board (Stage 8).
  onArchive: () => void;
}

export default function TicketCard({
  ticket,
  canUpdate,
  updating,
  archiving,
  onAdvance,
  onArchive,
}: Props) {
  const actionLabel = ACTION_LABELS[ticket.status];
  // Completed tickets can be closed/archived (kept in history) by anyone allowed
  // to act on them. This is NOT a delete — the ticket stays in the DB/history.
  const canArchive = ticket.status === 'Completed' && canUpdate;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-base font-bold text-gray-900">{ticket.license_plate}</span>
        <StatusBadge status={ticket.status} />
      </div>

      <p className="mb-2 line-clamp-2 text-sm text-gray-600">{ticket.description}</p>

      <p className="mb-3 text-xs text-gray-500">
        מכונאי: {ticket.mechanic_name ?? 'לא משויך'}
      </p>

      {actionLabel && canUpdate && (
        <button
          type="button"
          onClick={onAdvance}
          disabled={updating}
          className="w-full rounded-md bg-amber-600 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
        >
          {updating ? 'מעדכן...' : actionLabel}
        </button>
      )}

      {canArchive && (
        <button
          type="button"
          onClick={onArchive}
          disabled={archiving}
          className="w-full rounded-md border border-gray-300 bg-white py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          {archiving ? 'סוגר...' : 'סגור כרטיס'}
        </button>
      )}
    </article>
  );
}
