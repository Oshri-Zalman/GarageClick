import type { TicketsByDayRow } from '../types';
import { formatMinutes } from '../utils/duration';

interface Props {
  rows: TicketsByDayRow[];
  // True when the by-day endpoint failed to load — shows a Hebrew unavailable
  // state rather than an empty table.
  unavailable?: boolean;
}

// Per-day workload table (FR-6.3 / TDD §4.6 GET /api/admin/tickets/by-day).
// Shows created/completed counts and the average handling time for each day.
export default function TicketsByDaySummary({ rows, unavailable = false }: Props) {
  return (
    <section className="flex flex-col gap-3" aria-label="קריאות לפי יום">
      <h2 className="text-lg font-bold text-gray-800">קריאות לפי יום</h2>

      {unavailable ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          נתוני הקריאות לפי יום אינם זמינים כעת.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          אין נתוני קריאות לפי יום בטווח הנבחר.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">תאריך</th>
                <th scope="col" className="px-4 py-2 font-semibold">נפתחו</th>
                <th scope="col" className="px-4 py-2 font-semibold">הושלמו</th>
                <th scope="col" className="px-4 py-2 font-semibold">זמן טיפול ממוצע</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-800">{row.date}</td>
                  <td className="px-4 py-2 text-gray-800">{row.tickets_created}</td>
                  <td className="px-4 py-2 text-gray-800">{row.tickets_completed}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {formatMinutes(row.avg_completion_minutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
