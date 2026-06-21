import type { KanbanTicket } from '../types';
import MyTicketCard from './MyTicketCard';

interface Props {
  tickets: KanbanTicket[];
}

// Renders the archived/closed tickets as a history list of read-only cards
// (Stage 10). The page handles loading/empty/error states; this only draws the
// grid when there are tickets to show.
export default function MyTicketsList({ tickets }: Props) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <MyTicketCard ticket={ticket} />
        </li>
      ))}
    </ul>
  );
}
