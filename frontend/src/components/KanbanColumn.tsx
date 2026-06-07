import type { KanbanTicket, TicketStatus } from '../types';
import { STATUS_LABELS } from '../config/ticketStatus';
import TicketCard from './TicketCard';
import StatusCounter from './StatusCounter';

interface Props {
  status: TicketStatus;
  tickets: KanbanTicket[];
  canUpdate: (ticket: KanbanTicket) => boolean;
  updatingId: number | null;
  onAdvance: (ticket: KanbanTicket) => void;
}

export default function KanbanColumn({
  status,
  tickets,
  canUpdate,
  updatingId,
  onAdvance,
}: Props) {
  return (
    <section
      aria-label={STATUS_LABELS[status]}
      className="flex flex-col rounded-lg bg-gray-100 p-3"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700">{STATUS_LABELS[status]}</h2>
        <StatusCounter count={tickets.length} />
      </header>

      <div className="flex flex-col gap-3">
        {tickets.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">אין קריאות בעמודה זו</p>
        ) : (
          tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              canUpdate={canUpdate(ticket)}
              updating={updatingId === ticket.id}
              onAdvance={() => onAdvance(ticket)}
            />
          ))
        )}
      </div>
    </section>
  );
}
