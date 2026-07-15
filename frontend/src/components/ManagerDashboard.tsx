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
import {
  buildDateRangeParams,
  getDefaultDateRange,
  validateDateRange,
  type DateRange,
} from '../utils/dateRange';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import DateRangeFilter from './DateRangeFilter';
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
// The chosen date range is applied to the status summary, tickets-by-day and the
// per-mechanic performance reports. It is intentionally NOT applied to employee
// monitoring (ניטור עובדים) — GET /api/admin/employees has no date support and
// always reflects the current team state.
async function gatherManagerData(range: DateRange): Promise<ManagerData> {
  const [summaryRes, employeesRes, byDayRes] = await Promise.allSettled([
    getTicketsSummary(range),
    getEmployees(),
    getTicketsByDay(range),
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
    const results = await Promise.allSettled(assignable.map((e) => getPerformance(e.id, range)));
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
// degrade to a Hebrew "unavailable" state for that section only. A date-range
// filter scopes the summary/report sections (but not employee monitoring).
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

  // Draft inputs (what the user is typing) vs. the applied range (what was last
  // submitted and is reflected in the loaded data). Only "החל" promotes drafts.
  // Both default to the last week (today minus 6 days → today) so the initial
  // load is scoped to recent activity and sends start_date/end_date from the off.
  const [appliedRange, setAppliedRange] = useState<DateRange>(getDefaultDateRange);
  const [startInput, setStartInput] = useState(() => appliedRange.start_date ?? '');
  const [endInput, setEndInput] = useState(() => appliedRange.end_date ?? '');
  const [rangeError, setRangeError] = useState<string | null>(null);

  // State is only ever touched inside the `.then` callback (asynchronously), so
  // this is safe to call straight from an effect without cascading renders.
  const fetchData = useCallback(
    () =>
      gatherManagerData(appliedRange).then((data) => {
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
    [appliedRange]
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

  // Apply the date range. Invalid ranges (start after end) show a Hebrew error
  // and never trigger an API call. A valid range updates appliedRange, which the
  // effect picks up to re-fetch.
  const applyRange = useCallback(() => {
    const err = validateDateRange(startInput, endInput);
    setRangeError(err);
    if (err) return;
    setLoading(true);
    setAppliedRange(buildDateRangeParams(startInput, endInput));
  }, [startInput, endInput]);

  return (
    <div className="flex flex-col gap-8">
      <DateRangeFilter
        idPrefix="manager-dashboard-range"
        start={startInput}
        end={endInput}
        onStartChange={setStartInput}
        onEndChange={setEndInput}
        onApply={applyRange}
        error={rangeError}
      />

      {loading ? (
        <LoadingSpinner message="טוען לוח בקרה..." />
      ) : fatalError ? (
        <ErrorMessage message={fatalError} onRetry={reload} />
      ) : summary ? (
        <>
          <TicketStatusSummary
            pending={summary.total_pending}
            inProgress={summary.total_in_progress}
            completed={summary.total_completed}
          />
          <EmployeeMonitoringTable employees={employees} unavailable={employeesUnavailable} />
          <TicketsByDaySummary rows={byDay} unavailable={byDayUnavailable} />
          <PerformanceReportCards reports={performance} unavailable={performanceUnavailable} />
        </>
      ) : null}
    </div>
  );
}
