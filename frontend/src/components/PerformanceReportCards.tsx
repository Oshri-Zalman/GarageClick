import type { PerformanceReport } from '../types';

interface Props {
  reports: PerformanceReport[];
  // True when no performance data could be loaded — shows a Hebrew unavailable
  // state rather than an empty grid.
  unavailable?: boolean;
}

// Quality-oriented performance cards, one per mechanic (FR-6.5 / TDD §4.6
// GET /api/admin/reports/performance). The backend does not model ticket
// difficulty or a quality score, so the cards expose the throughput metrics that
// can actually be computed from stored data. The average time per ticket
// (avg_time_per_ticket_minutes) is intentionally NOT displayed: the dashboard no
// longer shows any average-time metric (product decision). The backend field is
// still returned and left untouched.
export default function PerformanceReportCards({ reports, unavailable = false }: Props) {
  return (
    <section className="flex flex-col gap-3" aria-label="דוחות ביצועים">
      <h2 className="text-lg font-bold text-gray-800">דוחות ביצועים</h2>

      {unavailable ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          דוחות הביצועים אינם זמינים כעת.
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          אין נתוני ביצועים להצגה.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <div
              key={report.mechanic_id}
              aria-label={`ביצועים: ${report.mechanic_name ?? 'עובד'}`}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <span className="text-base font-bold text-gray-800">
                {report.mechanic_name ?? 'עובד'}
              </span>
              <dl className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">קריאות שהושלמו</dt>
                  <dd className="font-semibold text-gray-800">{report.tickets_completed}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">שעות עבודה</dt>
                  <dd className="font-semibold text-gray-800">{report.total_work_hours}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
