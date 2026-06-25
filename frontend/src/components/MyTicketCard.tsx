import type { KanbanTicket } from '../types';
import { formatDateTime } from '../utils/myTickets';
import StatusBadge from './StatusBadge';
import TicketHistoryStatusBadge from './TicketHistoryStatusBadge';

interface Props {
  ticket: KanbanTicket;
}

// Read-only history card for a single closed/archived ticket (Stage 10). Shows
// the useful ticket details; there are deliberately no edit/advance actions —
// the ticket archive ("ארכיון כרטיסים") is an archive, not a working board.
export default function MyTicketCard({ ticket }: Props) {
  return (
    <article className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-bold text-gray-900">{ticket.license_plate}</span>
        <div className="flex items-center gap-2">
          <StatusBadge status={ticket.status} />
          <TicketHistoryStatusBadge />
        </div>
      </div>

      <p className="mb-3 text-sm text-gray-700">{ticket.description}</p>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs text-gray-500 sm:grid-cols-2">
        <Detail label="מספר כרטיס" value={ticket.ticket_number} />
        <Detail label="לקוח" value={ticket.customer_name} />
        <Detail label="מכונאי מטפל" value={ticket.mechanic_name ?? 'לא משויך'} />
        <Detail label="נפתח בתאריך" value={formatDateTime(ticket.created_at)} />
        <Detail label="נסגר ונשמר בהיסטוריה" value={formatDateTime(ticket.archived_at)} />
      </dl>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="font-semibold text-gray-600">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}
