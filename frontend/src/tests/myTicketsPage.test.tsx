import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MyTicketsPage from '../pages/MyTicketsPage';
import type { KanbanTicket, User } from '../types';

vi.mock('../services/tickets', () => ({
  listTickets: vi.fn(),
}));

import { listTickets } from '../services/tickets';

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

// One archived + one active ticket, both belonging to the current user — used to
// prove only archived tickets render.
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
  it('renders the page title', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'הכרטיסים שלי' })).toBeInTheDocument();
    await screen.findByText('11-111-11');
  });

  it('fetches tickets with include_archived=true', async () => {
    renderPage();
    await screen.findByText('11-111-11');
    expect(listTickets).toHaveBeenCalledTimes(1);
    expect(listTickets).toHaveBeenCalledWith({ include_archived: true });
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

  it('shows a Hebrew archive/closed label on archived tickets', async () => {
    renderPage();
    const card = (await screen.findByText('11-111-11')).closest('article')!;
    expect(within(card).getByText(/בארכיון/)).toBeInTheDocument();
  });

  it('shows useful ticket details (customer, mechanic, dates)', async () => {
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

  it('filters by status', async () => {
    renderPage();
    await screen.findByText('11-111-11');

    await userEvent.selectOptions(screen.getByLabelText('סטטוס'), 'In Progress');

    expect(screen.getByText('99-999-99')).toBeInTheDocument();
    expect(screen.queryByText('11-111-11')).not.toBeInTheDocument();
  });
});

describe('MyTicketsPage — role scoping', () => {
  const tickets = [
    makeTicket({ id: 1, archived_at: ARCHIVED_AT, license_plate: 'ASSIGNED', assigned_mechanic_id: ME, created_by_id: OTHER }),
    makeTicket({ id: 2, archived_at: ARCHIVED_AT, license_plate: 'CREATED', assigned_mechanic_id: OTHER, created_by_id: ME }),
    makeTicket({ id: 3, archived_at: ARCHIVED_AT, license_plate: 'OTHERS', assigned_mechanic_id: OTHER, created_by_id: OTHER }),
  ];

  beforeEach(() => {
    vi.mocked(listTickets).mockResolvedValue(tickets);
  });

  it('Mechanic sees only archived tickets assigned to them', async () => {
    renderPage(makeUser('Mechanic'));
    await screen.findByText('ASSIGNED');
    expect(screen.queryByText('CREATED')).not.toBeInTheDocument();
    expect(screen.queryByText('OTHERS')).not.toBeInTheDocument();
  });

  it('Manager sees archived tickets assigned to self or created by self', async () => {
    renderPage(makeUser('Manager'));
    await screen.findByText('ASSIGNED');
    expect(screen.getByText('CREATED')).toBeInTheDocument();
    expect(screen.queryByText('OTHERS')).not.toBeInTheDocument();
  });

  it('Secretary sees archived tickets created by self only', async () => {
    renderPage(makeUser('Secretary'));
    await screen.findByText('CREATED');
    expect(screen.queryByText('ASSIGNED')).not.toBeInTheDocument();
    expect(screen.queryByText('OTHERS')).not.toBeInTheDocument();
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
    expect(await screen.findByText('עדיין אין כרטיסים סגורים בהיסטוריה שלך.')).toBeInTheDocument();
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
