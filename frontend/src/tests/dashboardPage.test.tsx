import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from '../pages/DashboardPage';
import App from '../App';
import type {
  EmployeeMonitorRow,
  KanbanTicket,
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
}));

import { getTicketsSummary, getEmployees, getTicketsByDay, getPerformance } from '../services/admin';
import { listTickets } from '../services/tickets';

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

function ticket(id: number, status: KanbanTicket['status']): KanbanTicket {
  return {
    id,
    ticket_number: `T-${id}`,
    vehicle_id: id,
    created_by_id: 1,
    assigned_mechanic_id: 5,
    description: 'תקלה',
    status,
    created_at: '2026-06-02T08:00:00',
    started_at: null,
    completed_at: null,
    license_plate: '123-45-678',
    manufacturer: 'VW',
    model: 'Golf',
    year: 2018,
    customer_name: 'דן',
    customer_phone: '0500000000',
    mechanic_name: 'דוד',
  };
}

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

  it('shows the ticket status totals and average completion time', async () => {
    renderDashboard(MANAGER);
    const region = await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(within(region).getByText('5')).toBeInTheDocument();
    expect(within(region).getByText('3')).toBeInTheDocument();
    expect(within(region).getByText('8')).toBeInTheDocument();
    expect(within(region).getByText('4 שעות ו-30 דקות')).toBeInTheDocument();
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

  it('shows the performance report cards', async () => {
    renderDashboard(MANAGER);
    const region = await screen.findByRole('region', { name: 'דוחות ביצועים' });
    expect(within(region).getByText('דוד')).toBeInTheDocument();
    expect(within(region).getByText('12')).toBeInTheDocument();
    // Performance is fetched per assignable employee (Mechanic/Manager only).
    expect(getPerformance).toHaveBeenCalledTimes(1);
    expect(getPerformance).toHaveBeenCalledWith(5);
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
    // Average completion time falls back to the Hebrew placeholder.
    const region = screen.getByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(within(region).getByText('לא זמין')).toBeInTheDocument();
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
  it('renders the general status summary and operational overview', async () => {
    vi.mocked(listTickets).mockResolvedValue([
      ticket(1, 'Pending'),
      ticket(2, 'In Progress'),
      ticket(3, 'In Progress'),
      ticket(4, 'Completed'),
      ticket(5, 'Completed'),
      ticket(6, 'Completed'),
      ticket(7, 'Completed'),
    ]);
    renderDashboard(SECRETARY);

    const region = await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(within(region).getByText('1')).toBeInTheDocument(); // pending
    expect(within(region).getByText('2')).toBeInTheDocument(); // in progress
    expect(within(region).getByText('4')).toBeInTheDocument(); // completed
    expect(screen.getByRole('region', { name: 'סקירה תפעולית' })).toBeInTheDocument();
  });

  it('does not show manager-only employee monitoring or performance reports', async () => {
    vi.mocked(listTickets).mockResolvedValue([ticket(1, 'Pending')]);
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

  it('does not show the manager-only average completion time card', async () => {
    vi.mocked(listTickets).mockResolvedValue([ticket(1, 'Pending')]);
    renderDashboard(SECRETARY);
    const region = await screen.findByRole('region', { name: 'סיכום סטטוס קריאות' });
    expect(within(region).queryByText('זמן טיפול ממוצע')).not.toBeInTheDocument();
  });

  it('shows an empty operational state when there are no tickets', async () => {
    vi.mocked(listTickets).mockResolvedValue([]);
    renderDashboard(SECRETARY);
    expect(await screen.findByText('אין כרגע קריאות במערכת.')).toBeInTheDocument();
  });

  it('shows a Hebrew loading state while tickets load', () => {
    vi.mocked(listTickets).mockReturnValue(new Promise<KanbanTicket[]>(() => {}));
    renderDashboard(SECRETARY);
    expect(screen.getByText('טוען לוח בקרה...')).toBeInTheDocument();
  });

  it('shows a Hebrew error state with retry when tickets fail to load', async () => {
    vi.mocked(listTickets).mockRejectedValueOnce(new Error('500'));
    renderDashboard(SECRETARY);

    expect(await screen.findByText('שגיאה בטעינת הקריאות. נסה שוב.')).toBeInTheDocument();

    vi.mocked(listTickets).mockResolvedValueOnce([ticket(1, 'Pending')]);
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
