import { useCallback, useEffect, useState } from 'react';
import {
  getEmployees,
  getPerformance,
  getTicketsByDay,
  getTicketsSummary,
} from '../services/admin';
import type {
  EmployeeMonitorRow,
  PerformanceReport,
  TicketsByDayRow,
  TicketsSummary,
} from '../types';
import { apiErrorMessage } from '../utils/apiErrors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TicketStatusSummary from './TicketStatusSummary';
import EmployeeMonitoringTable from './EmployeeMonitoringTable';
import TicketsByDaySummary from './TicketsByDaySummary';
import PerformanceReportCards from './PerformanceReportCards';

// The resolved shape of one dashboard load. `fatal` is set only when the core
// status summary failed; every other section degrades to its own "unavailable"
// flag so one failing endpoint never takes down the whole page.
interface ManagerData {
  summary: TicketsSummary | null;
  fatal: string | null;
  employees: EmployeeMonitorRow[];
  employeesUnavailable: boolean;
  byDay: TicketsByDayRow[];
  byDayUnavailable: boolean;
  performance: PerformanceReport[];
  performanceUnavailable: boolean;
}

// Gathers every manager dataset (FR-6). Kept as a pure async function outside the
// component so it performs no setState itself — the caller applies the result in a
// `.then` callback, keeping all state updates off the synchronous effect path.
async function gatherManagerData(): Promise<ManagerData> {
  const [summaryRes, employeesRes, byDayRes] = await Promise.allSettled([
    getTicketsSummary(),
    getEmployees(),
    getTicketsByDay(),
  ]);

  // Status summary is the core of the page — if it fails, surface a retryable
  // error rather than a half-empty shell.
  if (summaryRes.status === 'rejected') {
    return {
      summary: null,
      fatal: apiErrorMessage(summaryRes.reason, 'שגיאה בטעינת לוח הבקרה. נסה שוב.'),
      employees: [],
      employeesUnavailable: false,
      byDay: [],
      byDayUnavailable: false,
      performance: [],
      performanceUnavailable: false,
    };
  }

  // Performance has no bulk endpoint, so it is computed per assignable employee
  // (Mechanic/Manager) once the employee list is known.
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

  return {
    summary: summaryRes.value,
    fatal: null,
    employees: employeesRes.status === 'fulfilled' ? employeesRes.value : [],
    employeesUnavailable: employeesRes.status === 'rejected',
    byDay: byDayRes.status === 'fulfilled' ? byDayRes.value : [],
    byDayUnavailable: byDayRes.status === 'rejected',
    performance,
    performanceUnavailable,
  };
}

// The full Manager dashboard (FR-6): status summary, employee monitoring,
// tickets-by-day and per-mechanic performance cards. A hard error (the status
// summary itself failed) shows a full retry state; individual section failures
// degrade to a Hebrew "unavailable" state for that section only.
export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const [summary, setSummary] = useState<TicketsSummary | null>(null);
  const [employees, setEmployees] = useState<EmployeeMonitorRow[]>([]);
  const [employeesUnavailable, setEmployeesUnavailable] = useState(false);
  const [byDay, setByDay] = useState<TicketsByDayRow[]>([]);
  const [byDayUnavailable, setByDayUnavailable] = useState(false);
  const [performance, setPerformance] = useState<PerformanceReport[]>([]);
  const [performanceUnavailable, setPerformanceUnavailable] = useState(false);

  // State is only ever touched inside the `.then` callback (asynchronously), so
  // this is safe to call straight from an effect without cascading renders.
  const fetchData = useCallback(
    () =>
      gatherManagerData().then((data) => {
        setSummary(data.summary);
        setFatalError(data.fatal);
        setEmployees(data.employees);
        setEmployeesUnavailable(data.employeesUnavailable);
        setByDay(data.byDay);
        setByDayUnavailable(data.byDayUnavailable);
        setPerformance(data.performance);
        setPerformanceUnavailable(data.performanceUnavailable);
        setLoading(false);
      }),
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Retry handler (runs in an event context, so synchronous resets are fine).
  const reload = useCallback(() => {
    setLoading(true);
    setFatalError(null);
    return fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner message="טוען לוח בקרה..." />;
  if (fatalError) return <ErrorMessage message={fatalError} onRetry={reload} />;
  if (!summary) return null;

  return (
    <div className="flex flex-col gap-8">
      <TicketStatusSummary
        pending={summary.total_pending}
        inProgress={summary.total_in_progress}
        completed={summary.total_completed}
        avgCompletionMinutes={summary.avg_completion_minutes}
      />
      <EmployeeMonitoringTable employees={employees} unavailable={employeesUnavailable} />
      <TicketsByDaySummary rows={byDay} unavailable={byDayUnavailable} />
      <PerformanceReportCards reports={performance} unavailable={performanceUnavailable} />
    </div>
  );
}
