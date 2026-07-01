import type { TicketStatus } from '../types';
import { STATUS_BADGE_STYLES, STATUS_LABELS } from '../config/ticketStatus';

interface Props {
  status: TicketStatus;
}

export default function StatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
