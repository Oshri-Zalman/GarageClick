import type { TicketStatus } from '../types';
import { STATUS_LABELS } from '../config/ticketStatus';

const STYLES: Record<TicketStatus, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  'In Progress': 'bg-orange-200 text-orange-900',
  Completed: 'bg-green-100 text-green-800',
};

interface Props {
  status: TicketStatus;
}

export default function StatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
