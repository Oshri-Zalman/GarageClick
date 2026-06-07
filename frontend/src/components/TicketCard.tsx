import type { KanbanTicket } from '../types';
import { ACTION_LABELS } from '../config/ticketStatus';
import StatusBadge from './StatusBadge';

interface Props {
  ticket: KanbanTicket;
  // Whether the current user is allowed to advance this ticket. Mechanics may
  // only update tickets assigned to them.
  canUpdate: boolean;
  // Whether a status update for this ticket is currently in flight.
  updating: boolean;
  onAdvance: () => void;
}

export default function TicketCard({ ticket, canUpdate, updating, onAdvance }: Props) {
  const actionLabel = ACTION_LABELS[ticket.status];

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
    </article>
  );
}
