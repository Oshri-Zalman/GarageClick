import type { EmployeeMonitorRow } from '../types';
import { roleLabel } from '../config/roles';
import { formatDateTime } from '../utils/datetime';

interface Props {
  employees: EmployeeMonitorRow[];
  // True when the employees endpoint failed to load — shows a Hebrew unavailable
  // state rather than an empty table.
  unavailable?: boolean;
}

// Formats the last-login timestamp for display in Israel local time, tolerating
// null (the backend returns null until a user has logged in at least once).
function formatLastLogin(value: string | null): string {
  return formatDateTime(value);
}

// Team monitoring table (FR-6.1 / TDD §4.6 GET /api/admin/employees). Shows open
// and completed-today ticket counts per employee. Real-time online presence is
// not tracked by the backend, so that column is intentionally omitted.
export default function EmployeeMonitoringTable({ employees, unavailable = false }: Props) {
  return (
    <section className="flex flex-col gap-3" aria-label="ניטור עובדים">
      <h2 className="text-lg font-bold text-gray-800">ניטור עובדים</h2>

      {unavailable ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          נתוני ניטור העובדים אינם זמינים כעת.
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          אין עובדים להצגה.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">עובד</th>
                <th scope="col" className="px-4 py-2 font-semibold">תפקיד</th>
                <th scope="col" className="px-4 py-2 font-semibold">קריאות פתוחות</th>
                <th scope="col" className="px-4 py-2 font-semibold">הושלמו היום</th>
                <th scope="col" className="px-4 py-2 font-semibold">התחברות אחרונה</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">{emp.name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{roleLabel(emp.role)}</td>
                  <td className="px-4 py-2 text-gray-800">{emp.tickets_open}</td>
                  <td className="px-4 py-2 text-gray-800">{emp.tickets_completed_today}</td>
                  <td className="px-4 py-2 text-gray-600">{formatLastLogin(emp.last_login)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
