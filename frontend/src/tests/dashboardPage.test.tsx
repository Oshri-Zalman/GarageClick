import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from '../pages/DashboardPage';
import App from '../App';
import type {
  EmployeeMonitorRow,
  PerformanceReport,
  TicketsByDayRow,
  TicketsSummary,
  User,
} from '../types';

vi.mock('../services/admin', () => ({
  getTicketsSummary: vi.fn(),
  getEmployees: vi.fn(),
  getTicketsByDay: vi.fn(),
  getPerformance: vi.fn(),
}));

vi.mock('../services/tickets', () => ({
  listTickets: vi.fn().mockResolvedValue([]),
  updateTicketStatus: vi.fn(),
  archiveTicket: vi.fn(),
}));

vi.mock('../services/staff', () => ({
  getStaffTicketsSummary: vi.fn(),
}));

import { getTicketsSummary, getEmployees, getTicketsByDay, getPerformance } from '../services/admin';
import { listTickets } from '../services/tickets';
import { getStaffTicketsSummary } from '../services/staff';

// useAuth reads the current user; swap it per test via this mutable ref.
let mockUser: User | null;
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, loading: false, error: null }),
}));

const MANAGER: User = { id: 1, username: 'uri', full_name: 'אורי', email: null, role: 'Manager', is_active: true };
const SECRETARY: User = { id: 2, username: 'sara', full_name: 'שרה', email: null, role: 'Secretary', is_active: true };
const MECHANIC: User = { id: 3, username: 'moshe', full_name: 'משה', email: null, role: 'Mechanic', is_active: true };

const SUMMARY: TicketsSummary = {
  total_pending: 5,
  total_in_progress: 3,
  total_completed: 8,
  avg_completion_minutes: 270,
};

const EMPLOYEES: EmployeeMonitorRow[] = [
  { id: 5, name: 'דוד', role: 'Mechanic', online: null, last_login: null, tickets_open: 3, tickets_completed_today: 5 },
  { id: 2, name: 'שרה', role: 'Secretary', online: null, last_login: null, tickets_open: 0, tickets_completed_today: 0 },
];

const BY_DAY: TicketsByDayRow[] = [
  { date: '2026-06-02', tickets_created: 8, tickets_completed: 6, avg_completion_minutes: 255 },
];

const PERFORMANCE: PerformanceReport = {
  mechanic_id: 5,
  mechanic_name: 'דוד',
  tickets_completed: 12,
  total_work_hours: 40,
  avg_time_per_ticket_minutes: 200,
};

function renderDashboard(user: User | null) {
  mockUser = user;
  return render(<DashboardPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(listTickets).mockResolvedValue([]);
});

describe('DashboardPage — Manager', () => {
  beforeEach(() => {
    vi.mocked(getTicketsSummary).mockResolvedValue(SUMMARY);
    vi.mocked(getEmployees).mockResolvedValue(EMPLOYEES);
    vi.mocked(getTicketsByDay).mockResolvedValue(BY_DAY);
    vi.mocked(getPerformance).mockResolvedValue(PERFORMANCE);
  });

  it('renders all manager sections', async () => {
    renderDashboard(MANAGER);
    expect(await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'ניטור עובדים' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'קריאות לפי יום' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'דוחות ביצועים' })).toBeInTheDocument();
  });

  it('shows the ticket status totals', async () => {
    renderDashboard(MANAGER);
    const region = await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(within(region).getByText('5')).toBeInTheDocument();
    expect(within(region).getByText('3')).toBeInTheDocument();
    expect(within(region).getByText('8')).toBeInTheDocument();
  });

  it('does not display any average-time metric anywhere on the dashboard', async () => {
    renderDashboard(MANAGER);
    await screen.findByRole('region', { name: 'דוחות ביצועים' });
    // The avg completion KPI/card/column is removed from the dashboard UI…
    expect(screen.queryByText('זמן טיפול ממוצע')).not.toBeInTheDocument();
    expect(screen.queryByText('4 שעות ו-30 דקות')).not.toBeInTheDocument();
    // …and so is the per-mechanic average time per ticket on the performance cards.
    expect(screen.queryByText('זמן ממוצע לקריאה')).not.toBeInTheDocument();
    expect(screen.queryByText('3 שעות ו-20 דקות')).not.toBeInTheDocument();
  });

  it('sends the applied date range to the admin summary and performance (not employee monitoring)', async () => {
    renderDashboard(MANAGER);
    await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });

    fireEvent.change(screen.getByLabelText('מתאריך'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('עד תאריך'), { target: { value: '2026-06-02' } });
    await userEvent.click(screen.getByRole('button', { name: 'החל' }));

    const range = { start_date: '2026-05-01', end_date: '2026-06-02' };
    await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(getTicketsSummary).toHaveBeenLastCalledWith(range);
    expect(getPerformance).toHaveBeenLastCalledWith(5, range);
    // Employee monitoring (ניטור עובדים) must NOT receive any date params.
    vi.mocked(getEmployees).mock.calls.forEach((call) => expect(call).toEqual([]));
  });

  it('shows a Hebrew validation error and calls no API for an invalid date range', async () => {
    renderDashboard(MANAGER);
    await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    vi.clearAllMocks();

    // start after end → invalid.
    fireEvent.change(screen.getByLabelText('מתאריך'), { target: { value: '2026-06-02' } });
    fireEvent.change(screen.getByLabelText('עד תאריך'), { target: { value: '2026-05-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'החל' }));

    expect(screen.getByText('תאריך ההתחלה חייב להיות מוקדם מתאריך הסיום.')).toBeInTheDocument();
    expect(getTicketsSummary).not.toHaveBeenCalled();
    expect(getPerformance).not.toHaveBeenCalled();
    expect(getEmployees).not.toHaveBeenCalled();
  });

  it('shows the employee monitoring table when employees are available', async () => {
    renderDashboard(MANAGER);
    const region = await screen.findByRole('region', { name: 'ניטור עובדים' });
    expect(within(region).getByText('דוד')).toBeInTheDocument();
    expect(within(region).getByText('מכונאי')).toBeInTheDocument();
  });

  it('shows the tickets-by-day summary', async () => {
    renderDashboard(MANAGER);
    const region = await screen.findByRole('region', { name: 'קריאות לפי יום' });
    expect(within(region).getByText('2026-06-02')).toBeInTheDocument();
  });

  it('shows the performance report cards (name + completed tickets + work hours)', async () => {
    renderDashboard(MANAGER);
    const region = await screen.findByRole('region', { name: 'דוחות ביצועים' });
    expect(within(region).getByText('דוד')).toBeInTheDocument();
    expect(within(region).getByText('12')).toBeInTheDocument(); // tickets_completed
    expect(within(region).getByText('קריאות שהושלמו')).toBeInTheDocument();
    expect(within(region).getByText('שעות עבודה')).toBeInTheDocument();
    // Performance is fetched per assignable employee (Mechanic/Manager only).
    expect(getPerformance).toHaveBeenCalledTimes(1);
    expect(getPerformance).toHaveBeenCalledWith(5, {});
  });

  it('does not show the average time per ticket on the performance cards', async () => {
    renderDashboard(MANAGER);
    const region = await screen.findByRole('region', { name: 'דוחות ביצועים' });
    expect(within(region).getByText('דוד')).toBeInTheDocument();
    // The avg-time metric (avg_time_per_ticket_minutes → "3 שעות ו-20 דקות") is gone.
    expect(within(region).queryByText('זמן ממוצע לקריאה')).not.toBeInTheDocument();
    expect(within(region).queryByText('3 שעות ו-20 דקות')).not.toBeInTheDocument();
  });

  it('shows a Hebrew unavailable state for employee monitoring when the endpoint fails', async () => {
    vi.mocked(getEmployees).mockRejectedValueOnce(new Error('500'));
    renderDashboard(MANAGER);
    const region = await screen.findByRole('region', { name: 'ניטור עובדים' });
    expect(within(region).getByText('נתוני ניטור העובדים אינם זמינים כעת.')).toBeInTheDocument();
  });

  it('shows a Hebrew unavailable state for tickets-by-day when the endpoint fails', async () => {
    vi.mocked(getTicketsByDay).mockRejectedValueOnce(new Error('500'));
    renderDashboard(MANAGER);
    const region = await screen.findByRole('region', { name: 'קריאות לפי יום' });
    expect(within(region).getByText('נתוני הקריאות לפי יום אינם זמינים כעת.')).toBeInTheDocument();
  });

  it('shows a Hebrew unavailable state for performance when employees cannot load', async () => {
    vi.mocked(getEmployees).mockRejectedValueOnce(new Error('500'));
    renderDashboard(MANAGER);
    const region = await screen.findByRole('region', { name: 'דוחות ביצועים' });
    expect(within(region).getByText('דוחות הביצועים אינם זמינים כעת.')).toBeInTheDocument();
  });

  it('shows empty states when there is no data', async () => {
    vi.mocked(getTicketsSummary).mockResolvedValue({
      total_pending: 0,
      total_in_progress: 0,
      total_completed: 0,
      avg_completion_minutes: null,
    });
    vi.mocked(getEmployees).mockResolvedValue([]);
    vi.mocked(getTicketsByDay).mockResolvedValue([]);
    renderDashboard(MANAGER);

    expect(await screen.findByText('אין עובדים להצגה.')).toBeInTheDocument();
    expect(screen.getByText('אין נתוני קריאות לפי יום בטווח הנבחר.')).toBeInTheDocument();
    expect(screen.getByText('אין נתוני ביצועים להצגה.')).toBeInTheDocument();
  });

  it('shows a Hebrew loading state while data loads', () => {
    vi.mocked(getTicketsSummary).mockReturnValue(new Promise<TicketsSummary>(() => {}));
    renderDashboard(MANAGER);
    expect(screen.getByText('טוען לוח בקרה...')).toBeInTheDocument();
  });

  it('shows a Hebrew error state with retry when the summary fails', async () => {
    vi.mocked(getTicketsSummary).mockRejectedValueOnce(new Error('500'));
    renderDashboard(MANAGER);

    expect(await screen.findByText('שגיאה בטעינת לוח הבקרה. נסה שוב.')).toBeInTheDocument();

    vi.mocked(getTicketsSummary).mockResolvedValueOnce(SUMMARY);
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' })).toBeInTheDocument();
  });
});

describe('DashboardPage — Secretary', () => {
  const STAFF_SUMMARY: TicketsSummary = {
    total_pending: 1,
    total_in_progress: 2,
    total_completed: 4,
    avg_completion_minutes: 180,
  };

  it('renders accurate status totals from the staff summary endpoint', async () => {
    vi.mocked(getStaffTicketsSummary).mockResolvedValue(STAFF_SUMMARY);
    renderDashboard(SECRETARY);

    const region = await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(within(region).getByText('1')).toBeInTheDocument(); // pending
    expect(within(region).getByText('2')).toBeInTheDocument(); // in progress
    expect(within(region).getByText('4')).toBeInTheDocument(); // completed
    expect(screen.getByRole('region', { name: 'סקירה תפעולית' })).toBeInTheDocument();

    // Totals come from GET /api/staff/tickets/summary, not the paginated ticket list.
    expect(getStaffTicketsSummary).toHaveBeenCalledTimes(1);
    expect(listTickets).not.toHaveBeenCalled();
  });

  it('does not show manager-only employee monitoring or performance reports', async () => {
    vi.mocked(getStaffTicketsSummary).mockResolvedValue(STAFF_SUMMARY);
    renderDashboard(SECRETARY);
    await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });

    expect(screen.queryByRole('region', { name: 'ניטור עובדים' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'דוחות ביצועים' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'קריאות לפי יום' })).not.toBeInTheDocument();
    // The Secretary view never touches the manager-only admin endpoints.
    expect(getTicketsSummary).not.toHaveBeenCalled();
    expect(getEmployees).not.toHaveBeenCalled();
    expect(getPerformance).not.toHaveBeenCalled();
  });

  it('does not display the average completion time on the secretary dashboard', async () => {
    vi.mocked(getStaffTicketsSummary).mockResolvedValue(STAFF_SUMMARY);
    renderDashboard(SECRETARY);
    await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(screen.queryByText('זמן טיפול ממוצע')).not.toBeInTheDocument();
    expect(screen.queryByText('3 שעות')).not.toBeInTheDocument();
  });

  it('sends the applied date range to the staff summary endpoint', async () => {
    vi.mocked(getStaffTicketsSummary).mockResolvedValue(STAFF_SUMMARY);
    renderDashboard(SECRETARY);
    await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });

    fireEvent.change(screen.getByLabelText('מתאריך'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('עד תאריך'), { target: { value: '2026-06-02' } });
    await userEvent.click(screen.getByRole('button', { name: 'החל' }));

    await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(getStaffTicketsSummary).toHaveBeenLastCalledWith({
      start_date: '2026-05-01',
      end_date: '2026-06-02',
    });
  });

  it('shows a Hebrew validation error and calls no API for an invalid date range', async () => {
    vi.mocked(getStaffTicketsSummary).mockResolvedValue(STAFF_SUMMARY);
    renderDashboard(SECRETARY);
    await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    vi.clearAllMocks();

    fireEvent.change(screen.getByLabelText('מתאריך'), { target: { value: '2026-06-02' } });
    fireEvent.change(screen.getByLabelText('עד תאריך'), { target: { value: '2026-05-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'החל' }));

    expect(screen.getByText('תאריך ההתחלה חייב להיות מוקדם מתאריך הסיום.')).toBeInTheDocument();
    expect(getStaffTicketsSummary).not.toHaveBeenCalled();
  });

  it('shows an empty operational state when there are no tickets', async () => {
    vi.mocked(getStaffTicketsSummary).mockResolvedValue({
      total_pending: 0,
      total_in_progress: 0,
      total_completed: 0,
      avg_completion_minutes: null,
    });
    renderDashboard(SECRETARY);
    expect(await screen.findByText('אין כרגע קריאות במערכת.')).toBeInTheDocument();
  });

  it('shows a Hebrew loading state while the summary loads', () => {
    vi.mocked(getStaffTicketsSummary).mockReturnValue(new Promise<TicketsSummary>(() => {}));
    renderDashboard(SECRETARY);
    expect(screen.getByText('טוען לוח בקרה...')).toBeInTheDocument();
  });

  it('shows a Hebrew error state with retry when the summary fails to load', async () => {
    vi.mocked(getStaffTicketsSummary).mockRejectedValueOnce(new Error('500'));
    renderDashboard(SECRETARY);

    expect(await screen.findByText('שגיאה בטעינת לוח הבקרה. נסה שוב.')).toBeInTheDocument();

    vi.mocked(getStaffTicketsSummary).mockResolvedValueOnce(STAFF_SUMMARY);
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' })).toBeInTheDocument();
  });
});

describe('DashboardPage — Mechanic route access', () => {
  it('redirects a Mechanic away from /dashboard to their Kanban home', async () => {
    mockUser = MECHANIC;
    sessionStorage.setItem('access_token', 'test-token');
    sessionStorage.setItem('current_user', JSON.stringify(MECHANIC));
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'ניטור עובדים' })).not.toBeInTheDocument();
  });
});
