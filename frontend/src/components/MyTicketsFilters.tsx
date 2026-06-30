interface Props {
  search: string;
  onSearchChange: (value: string) => void;
}

// Client-side search for the ticket archive (Stage 10). The status dropdown was
// removed — the archive is now filtered by a server-side date range instead (the
// page owns that), and the archive only ever contains closed tickets. Editing the
// tickets themselves is intentionally not possible from here.
export default function MyTicketsFilters({ search, onSearchChange }: Props) {
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
    </div>
  );
}
