import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportsPage from '../pages/ReportsPage';
import App from '../App';
import type {
  EmployeeMonitorRow,
  PerformanceReport,
  TicketsByDayRow,
  TicketsSummary,
  Role,
} from '../types';

vi.mock('../services/admin', () => ({
  getTicketsSummary: vi.fn(),
  getEmployees: vi.fn(),
  getTicketsByDay: vi.fn(),
  getPerformance: vi.fn(),
}));

// The Kanban board (Mechanic home) fetches tickets on mount; stub it so the
// route-guard integration tests stay offline.
vi.mock('../services/tickets', () => ({
  listTickets: vi.fn().mockResolvedValue([]),
  updateTicketStatus: vi.fn(),
  archiveTicket: vi.fn(),
}));

// The Secretary dashboard (Secretary home after redirect) reads the staff
// summary on mount; stub it so the redirect tests stay offline.
vi.mock('../services/staff', () => ({
  getStaffTicketsSummary: vi.fn().mockResolvedValue({
    total_pending: 0,
    total_in_progress: 0,
    total_completed: 0,
    avg_completion_minutes: null,
  }),
}));

import {
  getTicketsSummary,
  getEmployees,
  getTicketsByDay,
  getPerformance,
} from '../services/admin';

const SUMMARY: TicketsSummary = {
  total_pending: 5,
  total_in_progress: 3,
  total_completed: 8,
  avg_completion_minutes: 270,
};

const EMPLOYEES: EmployeeMonitorRow[] = [
  { id: 5, name: 'דוד', role: 'Mechanic', online: null, last_login: null, tickets_open: 3, tickets_completed_today: 5 },
  { id: 1, name: 'אורי', role: 'Manager', online: null, last_login: null, tickets_open: 1, tickets_completed_today: 2 },
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

// Resolve the per-employee performance fan-out by mechanic id so the order of
// Promise.allSettled does not matter.
function performanceFor(id: number): PerformanceReport {
  return { ...PERFORMANCE, mechanic_id: id, mechanic_name: id === 5 ? 'דוד' : 'אורי' };
}

function setHappyPath() {
  vi.mocked(getTicketsSummary).mockResolvedValue(SUMMARY);
  vi.mocked(getEmployees).mockResolvedValue(EMPLOYEES);
  vi.mocked(getTicketsByDay).mockResolvedValue(BY_DAY);
  vi.mocked(getPerformance).mockImplementation((id: number) =>
    Promise.resolve(performanceFor(id))
  );
}

function loginAs(role: Role) {
  sessionStorage.setItem('access_token', 'test-token');
  sessionStorage.setItem(
    'current_user',
    JSON.stringify({ id: 1, username: 'u', full_name: 'משתמש', email: null, role, is_active: true })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('ReportsPage — content', () => {
  beforeEach(setHappyPath);

  it('renders the "דוחות" page title and a Hebrew manager description', async () => {
    render(<ReportsPage />);
    expect(await screen.findByRole('heading', { name: 'דוחות' })).toBeInTheDocument();
    expect(screen.getByText(/דוחות מנהל מרוכזים/)).toBeInTheDocument();
  });

  it('renders the ticket status summary from GET /api/admin/tickets/summary', async () => {
    render(<ReportsPage />);
    const region = await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(within(region).getByText('5')).toBeInTheDocument();
    expect(within(region).getByText('3')).toBeInTheDocument();
    expect(within(region).getByText('8')).toBeInTheDocument();
    expect(within(region).getByText('4 שעות ו-30 דקות')).toBeInTheDocument();
    expect(getTicketsSummary).toHaveBeenCalledTimes(1);
  });

  it('renders the tickets-by-day section', async () => {
    render(<ReportsPage />);
    const region = await screen.findByRole('region', { name: 'קריאות לפי יום' });
    expect(within(region).getByText('2026-06-02')).toBeInTheDocument();
  });

  it('renders the employee performance cards', async () => {
    render(<ReportsPage />);
    const region = await screen.findByRole('region', { name: 'דוחות ביצועים' });
    expect(within(region).getByText('דוד')).toBeInTheDocument();
    expect(within(region).getByText('אורי')).toBeInTheDocument();
  });

  it('calls GET /api/admin/reports/performance once per relevant employee', async () => {
    render(<ReportsPage />);
    await screen.findByRole('region', { name: 'דוחות ביצועים' });
    // Performance is fetched per assignable employee (Mechanic/Manager) only —
    // the Secretary in EMPLOYEES is excluded.
    expect(getPerformance).toHaveBeenCalledTimes(2);
    expect(getPerformance).toHaveBeenCalledWith(5);
    expect(getPerformance).toHaveBeenCalledWith(1);
    expect(getPerformance).not.toHaveBeenCalledWith(2);
  });

  it('does NOT render the employee monitoring table ("ניטור עובדים")', async () => {
    render(<ReportsPage />);
    await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(screen.queryByRole('region', { name: 'ניטור עובדים' })).not.toBeInTheDocument();
    expect(screen.queryByText('ניטור עובדים')).not.toBeInTheDocument();
    expect(getEmployees).toHaveBeenCalledTimes(1); // used only for the perf fan-out
  });
});

describe('ReportsPage — date range', () => {
  beforeEach(setHappyPath);

  it('sends start_date/end_date to GET /api/admin/tickets/by-day on apply', async () => {
    render(<ReportsPage />);
    await screen.findByRole('region', { name: 'קריאות לפי יום' });
    // The initial mount loads the default (last 30 days) range with no params.
    vi.mocked(getTicketsByDay).mockClear();

    await userEvent.type(screen.getByLabelText('מתאריך'), '2026-06-01');
    await userEvent.type(screen.getByLabelText('עד תאריך'), '2026-06-10');
    await userEvent.click(screen.getByRole('button', { name: 'החל' }));

    expect(getTicketsByDay).toHaveBeenCalledTimes(1);
    expect(getTicketsByDay).toHaveBeenCalledWith({
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
  });

  it('shows a Hebrew validation message and does NOT call the API for start_date > end_date', async () => {
    render(<ReportsPage />);
    await screen.findByRole('region', { name: 'קריאות לפי יום' });
    vi.mocked(getTicketsByDay).mockClear();

    await userEvent.type(screen.getByLabelText('מתאריך'), '2026-06-20');
    await userEvent.type(screen.getByLabelText('עד תאריך'), '2026-06-10');
    await userEvent.click(screen.getByRole('button', { name: 'החל' }));

    expect(screen.getByText('תאריך ההתחלה חייב להיות מוקדם מתאריך הסיום.')).toBeInTheDocument();
    expect(getTicketsByDay).not.toHaveBeenCalled();
  });
});

describe('ReportsPage — states', () => {
  it('shows a Hebrew loading state while data loads', () => {
    vi.mocked(getTicketsSummary).mockReturnValue(new Promise<TicketsSummary>(() => {}));
    vi.mocked(getEmployees).mockResolvedValue([]);
    vi.mocked(getTicketsByDay).mockResolvedValue([]);
    render(<ReportsPage />);
    expect(screen.getByText('טוען דוחות...')).toBeInTheDocument();
  });

  it('shows a full-page error with retry when the core summary fails', async () => {
    vi.mocked(getTicketsSummary).mockRejectedValueOnce(new Error('500'));
    vi.mocked(getEmployees).mockResolvedValue([]);
    vi.mocked(getTicketsByDay).mockResolvedValue([]);
    render(<ReportsPage />);

    expect(await screen.findByText('שגיאה בטעינת הדוחות. נסה שוב.')).toBeInTheDocument();

    // Retry succeeds and the page renders.
    setHappyPath();
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByRole('heading', { name: 'דוחות' })).toBeInTheDocument();
  });

  it('shows a per-section unavailable state when tickets-by-day fails', async () => {
    vi.mocked(getTicketsSummary).mockResolvedValue(SUMMARY);
    vi.mocked(getEmployees).mockResolvedValue(EMPLOYEES);
    vi.mocked(getPerformance).mockImplementation((id: number) => Promise.resolve(performanceFor(id)));
    vi.mocked(getTicketsByDay).mockRejectedValueOnce(new Error('500'));
    render(<ReportsPage />);

    const region = await screen.findByRole('region', { name: 'קריאות לפי יום' });
    expect(within(region).getByText('נתוני הקריאות לפי יום אינם זמינים כעת.')).toBeInTheDocument();
  });

  it('shows a per-section unavailable state when performance fails', async () => {
    vi.mocked(getTicketsSummary).mockResolvedValue(SUMMARY);
    vi.mocked(getEmployees).mockResolvedValue(EMPLOYEES);
    vi.mocked(getTicketsByDay).mockResolvedValue(BY_DAY);
    vi.mocked(getPerformance).mockRejectedValue(new Error('500'));
    render(<ReportsPage />);

    const region = await screen.findByRole('region', { name: 'דוחות ביצועים' });
    expect(within(region).getByText('דוחות הביצועים אינם זמינים כעת.')).toBeInTheDocument();
  });

  it('shows an empty state when there is no tickets-by-day data', async () => {
    vi.mocked(getTicketsSummary).mockResolvedValue(SUMMARY);
    vi.mocked(getEmployees).mockResolvedValue([]);
    vi.mocked(getTicketsByDay).mockResolvedValue([]);
    render(<ReportsPage />);

    const region = await screen.findByRole('region', { name: 'קריאות לפי יום' });
    expect(within(region).getByText('אין נתוני קריאות לפי יום בטווח הנבחר.')).toBeInTheDocument();
  });

  it('shows an empty state when there are no assignable employees for performance', async () => {
    vi.mocked(getTicketsSummary).mockResolvedValue(SUMMARY);
    vi.mocked(getEmployees).mockResolvedValue([]);
    vi.mocked(getTicketsByDay).mockResolvedValue(BY_DAY);
    render(<ReportsPage />);

    const region = await screen.findByRole('region', { name: 'דוחות ביצועים' });
    expect(within(region).getByText('אין נתוני ביצועים להצגה.')).toBeInTheDocument();
    expect(getPerformance).not.toHaveBeenCalled();
  });
});

describe('ReportsPage — route access', () => {
  beforeEach(setHappyPath);

  function goTo(path: string) {
    window.history.pushState({}, '', path);
  }

  it('lets a Manager open /reports', async () => {
    loginAs('Manager');
    goTo('/reports');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'דוחות' })).toBeInTheDocument();
  });

  it('redirects a Secretary away from /reports to their home page', async () => {
    loginAs('Secretary');
    goTo('/reports');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'לוח בקרה' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'דוחות' })).not.toBeInTheDocument();
    expect(getTicketsSummary).not.toHaveBeenCalled();
  });

  it('redirects a Mechanic away from /reports to Kanban', async () => {
    loginAs('Mechanic');
    goTo('/reports');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'דוחות' })).not.toBeInTheDocument();
    expect(getTicketsSummary).not.toHaveBeenCalled();
  });
});
