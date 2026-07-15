import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MyTicketsPage from '../pages/MyTicketsPage';
import type { KanbanTicket, User } from '../types';

vi.mock('../services/tickets', () => ({
  listTickets: vi.fn(),
}));

import { listTickets } from '../services/tickets';
import { getDefaultDateRange } from '../utils/dateRange';

// The archive date-range filter defaults to the last week, so the first request
// carries these start/end params alongside archived_only.
const DEFAULT_RANGE = getDefaultDateRange();

// useAuth reads the current user; swap it per test via this mutable ref.
let mockUser: User | null;
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, loading: false, error: null }),
}));

const ME = 10;
const OTHER = 20;

function makeUser(role: User['role'], id = ME): User {
  return { id, username: 'u', full_name: 'משתמש', email: null, role, is_active: true };
}

function makeTicket(overrides: Partial<KanbanTicket>): KanbanTicket {
  return {
    id: 0,
    ticket_number: 'TKT-00000',
    vehicle_id: 1,
    created_by_id: ME,
    assigned_mechanic_id: ME,
    description: 'תיאור',
    status: 'Completed',
    created_at: '2026-06-01T08:00:00Z',
    started_at: null,
    completed_at: null,
    archived_at: null,
    license_plate: '00-000-00',
    manufacturer: 'Toyota',
    model: 'Corolla',
    year: 2020,
    customer_name: 'לקוח',
    customer_phone: '0500000000',
    mechanic_name: 'דוד',
    ...overrides,
  };
}

const ARCHIVED_AT = '2026-06-18T10:00:00Z';

const ARCHIVED = makeTicket({
  id: 1,
  status: 'Completed',
  archived_at: ARCHIVED_AT,
  license_plate: '11-111-11',
  description: 'החלפת מצבר',
  customer_name: 'משה כהן',
  mechanic_name: 'דוד',
});
const ACTIVE_COMPLETED = makeTicket({
  id: 2,
  status: 'Completed',
  archived_at: null,
  license_plate: '22-222-22',
});
const ACTIVE_PENDING = makeTicket({
  id: 3,
  status: 'Pending',
  archived_at: null,
  license_plate: '33-333-33',
});

function renderPage(user: User | null = makeUser('Mechanic')) {
  mockUser = user;
  return render(<MyTicketsPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listTickets).mockResolvedValue([ARCHIVED, ACTIVE_COMPLETED, ACTIVE_PENDING]);
});

describe('MyTicketsPage — rendering & data source', () => {
  it('renders the archive page title', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'ארכיון כרטיסים' })).toBeInTheDocument();
    await screen.findByText('11-111-11');
  });

  it('fetches tickets with archived_only=true plus the default last-week range', async () => {
    renderPage();
    await screen.findByText('11-111-11');
    expect(listTickets).toHaveBeenCalledTimes(1);
    expect(listTickets).toHaveBeenCalledWith({ archived_only: true, ...DEFAULT_RANGE });
    expect(listTickets).not.toHaveBeenCalledWith({ include_archived: true });
  });

  it('shows only archived tickets and hides active ones', async () => {
    renderPage();
    await screen.findByText('11-111-11');

    // Archived ticket is shown.
    expect(screen.getByText('11-111-11')).toBeInTheDocument();
    // Active tickets (incl. a Completed-but-not-archived one) are hidden.
    expect(screen.queryByText('22-222-22')).not.toBeInTheDocument();
    expect(screen.queryByText('33-333-33')).not.toBeInTheDocument();
  });

  it('shows "בארכיון" and not the "הושלם" status on archive cards', async () => {
    renderPage();
    const card = (await screen.findByText('11-111-11')).closest('article')!;
    // Archive cards surface only "בארכיון" — the "הושלם" status pill is dropped
    // since every archived ticket is already closed.
    expect(within(card).getByText(/בארכיון/)).toBeInTheDocument();
    expect(within(card).queryByText('הושלם')).not.toBeInTheDocument();
  });

  it('shows useful ticket details (customer, mechanic, description)', async () => {
    renderPage();
    const card = (await screen.findByText('11-111-11')).closest('article')!;
    expect(within(card).getByText('משה כהן')).toBeInTheDocument();
    expect(within(card).getByText('דוד')).toBeInTheDocument();
    expect(within(card).getByText('החלפת מצבר')).toBeInTheDocument();
  });
});

describe('MyTicketsPage — search & filter', () => {
  beforeEach(() => {
    vi.mocked(listTickets).mockResolvedValue([
      makeTicket({ id: 1, archived_at: ARCHIVED_AT, license_plate: '11-111-11', status: 'Completed' }),
      makeTicket({ id: 2, archived_at: ARCHIVED_AT, license_plate: '99-999-99', status: 'In Progress' }),
    ]);
  });

  it('filters by license plate', async () => {
    renderPage();
    await screen.findByText('11-111-11');

    await userEvent.type(screen.getByLabelText('חיפוש לפי מספר רכב'), '99');

    expect(screen.getByText('99-999-99')).toBeInTheDocument();
    expect(screen.queryByText('11-111-11')).not.toBeInTheDocument();
  });

  it('shows a no-match message when search finds nothing', async () => {
    renderPage();
    await screen.findByText('11-111-11');

    await userEvent.type(screen.getByLabelText('חיפוש לפי מספר רכב'), 'zzz');

    expect(screen.getByText('לא נמצאו כרטיסים התואמים את החיפוש.')).toBeInTheDocument();
  });

  it('no longer renders the status dropdown filter', async () => {
    renderPage();
    await screen.findByText('11-111-11');
    expect(screen.queryByLabelText('סטטוס')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'בטיפול' })).not.toBeInTheDocument();
  });
});

describe('MyTicketsPage — date range filter', () => {
  beforeEach(() => {
    vi.mocked(listTickets).mockResolvedValue([ARCHIVED]);
  });

  it('renders start/end inputs with type="date" pre-filled with the default range', async () => {
    renderPage();
    await screen.findByText('11-111-11');
    const start = screen.getByLabelText('מתאריך');
    const end = screen.getByLabelText('עד תאריך');
    expect(start).toHaveAttribute('type', 'date');
    expect(end).toHaveAttribute('type', 'date');
    // Default last-week range is shown in the inputs from the off.
    expect(start).toHaveValue(DEFAULT_RANGE.start_date);
    expect(end).toHaveValue(DEFAULT_RANGE.end_date);
  });

  it('sends archived_only:true plus the applied start_date/end_date', async () => {
    renderPage();
    await screen.findByText('11-111-11');

    fireEvent.change(screen.getByLabelText('מתאריך'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('עד תאריך'), { target: { value: '2026-06-02' } });
    await userEvent.click(screen.getByRole('button', { name: 'החל' }));

    await waitFor(() =>
      expect(listTickets).toHaveBeenLastCalledWith({
        archived_only: true,
        start_date: '2026-05-01',
        end_date: '2026-06-02',
      })
    );
  });

  it('shows a Hebrew validation error and does not call the API for an invalid range', async () => {
    renderPage();
    await screen.findByText('11-111-11');
    vi.clearAllMocks();

    fireEvent.change(screen.getByLabelText('מתאריך'), { target: { value: '2026-06-02' } });
    fireEvent.change(screen.getByLabelText('עד תאריך'), { target: { value: '2026-05-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'החל' }));

    expect(screen.getByText('תאריך ההתחלה חייב להיות מוקדם מתאריך הסיום.')).toBeInTheDocument();
    expect(listTickets).not.toHaveBeenCalled();
  });
});

describe('MyTicketsPage — role scoping', () => {
  // Two archived tickets: one assigned to the current user, one to someone else.
  const tickets = [
    makeTicket({ id: 1, archived_at: ARCHIVED_AT, license_plate: 'MINE', assigned_mechanic_id: ME }),
    makeTicket({ id: 2, archived_at: ARCHIVED_AT, license_plate: 'OTHERS', assigned_mechanic_id: OTHER }),
  ];

  beforeEach(() => {
    vi.mocked(listTickets).mockResolvedValue(tickets);
  });

  it('Mechanic sees only archived tickets assigned to them and no scope tabs', async () => {
    renderPage(makeUser('Mechanic'));
    await screen.findByText('MINE');
    expect(screen.queryByText('OTHERS')).not.toBeInTheDocument();
    // A Mechanic has a single fixed scope — no tabs.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('Secretary sees the whole garage archive and no scope tabs', async () => {
    renderPage(makeUser('Secretary'));
    await screen.findByText('MINE');
    expect(screen.getByText('OTHERS')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    // Secretary has no personal/garage toggle.
    expect(screen.queryByRole('tab', { name: 'הארכיון שלי' })).not.toBeInTheDocument();
  });

  it('Manager defaults to the personal archive (assigned to self only)', async () => {
    renderPage(makeUser('Manager'));
    await screen.findByText('MINE');
    expect(screen.queryByText('OTHERS')).not.toBeInTheDocument();
    // Two tabs are shown, personal selected by default.
    expect(screen.getByRole('tab', { name: 'הארכיון שלי' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'ארכיון המוסך' })).toHaveAttribute('aria-selected', 'false');
  });

  it('Manager can switch to the garage archive to see all archived tickets', async () => {
    renderPage(makeUser('Manager'));
    await screen.findByText('MINE');

    await userEvent.click(screen.getByRole('tab', { name: 'ארכיון המוסך' }));

    expect(screen.getByText('MINE')).toBeInTheDocument();
    expect(screen.getByText('OTHERS')).toBeInTheDocument();
  });
});

describe('MyTicketsPage — states', () => {
  it('shows a Hebrew loading state before tickets arrive', () => {
    vi.mocked(listTickets).mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByText('טוען כרטיסים...')).toBeInTheDocument();
  });

  it('shows a Hebrew empty state when there are no archived tickets', async () => {
    vi.mocked(listTickets).mockResolvedValue([ACTIVE_PENDING]); // only active tickets
    renderPage();
    expect(await screen.findByText('אין כרטיסים סגורים בארכיון להצגה.')).toBeInTheDocument();
  });

  it('shows a Hebrew error state with retry that re-fetches', async () => {
    vi.mocked(listTickets).mockRejectedValueOnce(new Error('network'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('שגיאה בטעינת הכרטיסים. נסה שוב.');

    vi.mocked(listTickets).mockResolvedValue([ARCHIVED]);
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    await waitFor(() => expect(screen.getByText('11-111-11')).toBeInTheDocument());
  });
});
