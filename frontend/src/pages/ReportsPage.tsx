import { useCallback, useEffect, useState } from 'react';
import {
  getEmployees,
  getPerformance,
  getTicketsByDay,
  getTicketsSummary,
} from '../services/admin';
import type { PerformanceReport, TicketsByDayRow, TicketsSummary } from '../types';
import { apiErrorMessage } from '../utils/apiErrors';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import TicketStatusSummary from '../components/TicketStatusSummary';
import TicketsByDaySummary from '../components/TicketsByDaySummary';
import PerformanceReportCards from '../components/PerformanceReportCards';
import ReportsDateRangeFilter from '../components/ReportsDateRangeFilter';

// Optional date range for the tickets-by-day report. The backend defaults to the
// last 30 days when no range is supplied (TDD §4.6).
interface ByDayParams {
  start_date?: string;
  end_date?: string;
}

// The resolved shape of the core (non date-range) report load. `fatal` is set
// only when the all-time status summary failed; performance degrades to its own
// "unavailable" flag so one failing endpoint never takes down the whole page.
interface CoreData {
  summary: TicketsSummary | null;
  fatal: string | null;
  performance: PerformanceReport[];
  performanceUnavailable: boolean;
}

// Gathers the all-time summary and per-employee performance reports (Stage 11,
// FR-6). Kept as a pure async function so it performs no setState itself — the
// caller applies the result in a `.then` callback.
async function gatherCore(): Promise<CoreData> {
  const [summaryRes, employeesRes] = await Promise.allSettled([
    getTicketsSummary(),
    getEmployees(),
  ]);

  // The status summary is the core of the page — if it fails, surface a
  // retryable full-page error rather than a half-empty shell.
  if (summaryRes.status === 'rejected') {
    return {
      summary: null,
      fatal: apiErrorMessage(summaryRes.reason, 'שגיאה בטעינת הדוחות. נסה שוב.'),
      performance: [],
      performanceUnavailable: false,
    };
  }

  // Performance has no bulk endpoint, so it is computed once per assignable
  // employee (Mechanic/Manager) after the employee list is known.
  let performance: PerformanceReport[] = [];
  let performanceUnavailable: boolean;
  if (employeesRes.status === 'fulfilled') {
    const assignable = employeesRes.value.filter(
      (e) => e.role === 'Mechanic' || e.role === 'Manager'
    );
    const results = await Promise.allSettled(assignable.map((e) => getPerformance(e.id)));
    performance = results
      .filter((r): r is PromiseFulfilledResult<PerformanceReport> => r.status === 'fulfilled')
      .map((r) => r.value);
    // Only flag unavailable when we attempted calls and every one failed.
    performanceUnavailable = results.length > 0 && performance.length === 0;
  } else {
    performanceUnavailable = true;
  }

  return { summary: summaryRes.value, fatal: null, performance, performanceUnavailable };
}

// Manager-only Reports page (Stage 11, FR-6). Aggregates three reports: the
// all-time ticket status summary, a date-range tickets-by-day report, and
// per-employee performance cards. It deliberately does NOT render the employee
// monitoring table — that lives in the Manager Dashboard (/dashboard). The route
// guard (config/access: allowedRoles('/reports')) restricts this page to Manager;
// Secretary and Mechanic are redirected to their own home page.
export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const [summary, setSummary] = useState<TicketsSummary | null>(null);
  const [performance, setPerformance] = useState<PerformanceReport[]>([]);
  const [performanceUnavailable, setPerformanceUnavailable] = useState(false);

  const [byDay, setByDay] = useState<TicketsByDayRow[]>([]);
  const [byDayUnavailable, setByDayUnavailable] = useState(false);

  // Tickets-by-day is loaded independently so the date-range filter can refresh
  // just this section without reloading the whole page. A failure degrades to a
  // Hebrew "unavailable" state instead of rejecting.
  const loadByDay = useCallback(
    (params: ByDayParams = {}) =>
      getTicketsByDay(params).then(
        (rows) => {
          setByDay(rows);
          setByDayUnavailable(false);
        },
        () => {
          setByDay([]);
          setByDayUnavailable(true);
        }
      ),
    []
  );

  const loadCore = useCallback(
    () =>
      gatherCore().then((data) => {
        setSummary(data.summary);
        setFatalError(data.fatal);
        setPerformance(data.performance);
        setPerformanceUnavailable(data.performanceUnavailable);
      }),
    []
  );

  // State is only ever touched inside `.then` callbacks (asynchronously), so
  // this is safe to call straight from an effect without cascading renders.
  const loadAll = useCallback(
    () => Promise.all([loadCore(), loadByDay()]).then(() => setLoading(false)),
    [loadCore, loadByDay]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Retry handler (runs in an event context, so synchronous resets are fine).
  const reload = useCallback(() => {
    setLoading(true);
    setFatalError(null);
    return loadAll();
  }, [loadAll]);

  if (loading) return <LoadingSpinner message="טוען דוחות..." />;
  if (fatalError) return <ErrorMessage message={fatalError} onRetry={reload} />;
  if (!summary) return null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-gray-800">דוחות</h1>
        <p className="text-gray-500">
          דוחות מנהל מרוכזים לסדנה: סיכום כללי של סטטוס הקריאות, פילוח קריאות לפי יום וביצועי
          העובדים. זמין למנהל בלבד.
        </p>
      </div>

      <TicketStatusSummary
        pending={summary.total_pending}
        inProgress={summary.total_in_progress}
        completed={summary.total_completed}
        avgCompletionMinutes={summary.avg_completion_minutes}
      />

      <div className="flex flex-col gap-3">
        <ReportsDateRangeFilter onApply={loadByDay} />
        <TicketsByDaySummary rows={byDay} unavailable={byDayUnavailable} />
      </div>

      <PerformanceReportCards reports={performance} unavailable={performanceUnavailable} />
    </div>
  );
}
