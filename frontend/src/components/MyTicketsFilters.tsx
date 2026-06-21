import type { TicketStatus } from '../types';
import { STATUS_LABELS, STATUS_ORDER } from '../config/ticketStatus';

export type StatusFilter = TicketStatus | 'all';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
}

// Search + status filtering for the personal ticket history (Stage 10). The page
// owns the filter state; this is a controlled presentational component. Editing
// the tickets themselves is intentionally not possible from here.
export default function MyTicketsFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="my-tickets-search" className="text-xs font-semibold text-gray-600">
          חיפוש לפי מספר רכב
        </label>
        <input
          id="my-tickets-search"
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="לדוגמה: 12-345-67"
          className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="my-tickets-status" className="text-xs font-semibold text-gray-600">
          סטטוס
        </label>
        <select
          id="my-tickets-status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
          className="w-44 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        >
          <option value="all">הכל</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
