import apiClient from './apiClient';
import type {
  EmployeeMonitorRow,
  PerformanceReport,
  TicketsByDayRow,
  TicketsSummary,
} from '../types';

// Admin / dashboard service — wraps the Manager-only endpoints under
// /api/admin (TDD §4.6). Every route is guarded by require_roles("Manager") on
// the backend, so these must only be called from the Manager dashboard; the
// Secretary dashboard derives its summary from GET /api/tickets instead. Errors
// are propagated so callers can show a Hebrew error/unavailable state.

// GET /api/admin/tickets/summary — counts per status + average completion time.
export async function getTicketsSummary(): Promise<TicketsSummary> {
  const { data } = await apiClient.get<TicketsSummary>('/admin/tickets/summary');
  return data;
}

// GET /api/admin/employees — team monitoring rows (open + completed-today counts).
export async function getEmployees(): Promise<EmployeeMonitorRow[]> {
  const { data } = await apiClient.get<EmployeeMonitorRow[]>('/admin/employees');
  return data;
}

interface ByDayParams {
  start_date?: string;
  end_date?: string;
}

// GET /api/admin/tickets/by-day — per-day created/completed counts and average
// handling time. Without a range the backend defaults to the last 30 days.
export async function getTicketsByDay(params: ByDayParams = {}): Promise<TicketsByDayRow[]> {
  const { data } = await apiClient.get<TicketsByDayRow[]>('/admin/tickets/by-day', { params });
  return data;
}

// GET /api/admin/reports/performance?mechanic_id=... — quality metrics for one
// mechanic. The backend has no bulk endpoint, so the dashboard calls this once
// per assignable employee to build the performance cards.
export async function getPerformance(mechanicId: number): Promise<PerformanceReport> {
  const { data } = await apiClient.get<PerformanceReport>('/admin/reports/performance', {
    params: { mechanic_id: mechanicId },
  });
  return data;
}
