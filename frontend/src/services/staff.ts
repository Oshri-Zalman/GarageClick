import apiClient from './apiClient';
import type { TicketsSummary } from '../types';
import type { DateRange } from '../utils/dateRange';

// Staff (Manager + Secretary) operational endpoints under /api/staff (Stage 8
// backend follow-up). Distinct from the Manager-only /api/admin/* reports: this
// exposes lightweight ticket counts + average completion time WITHOUT any
// per-employee performance or monitoring, so the Secretary dashboard can show an
// accurate summary without computing it from the paginated /api/tickets list.

// GET /api/staff/tickets/summary — status counts + average completion minutes.
// Accepts an optional start_date/end_date range (the Secretary dashboard date
// filter). The Secretary dashboard does not display the average completion time.
export async function getStaffTicketsSummary(range: DateRange = {}): Promise<TicketsSummary> {
  const { data } = await apiClient.get<TicketsSummary>('/staff/tickets/summary', {
    params: range,
  });
  return data;
}
