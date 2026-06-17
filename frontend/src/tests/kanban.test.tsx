import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import KanbanBoard from '../components/KanbanBoard';
import type { KanbanTicket, Role, User } from '../types';

vi.mock('../services/tickets', () => ({
  listTickets: vi.fn(),
  updateTicketStatus: vi.fn(),
  archiveTicket: vi.fn(),
}));

import { AxiosError } from 'axios';
import { listTickets, updateTicketStatus, archiveTicket } from '../services/tickets';

function axiosError(detail: string): AxiosError {
  const err = new AxiosError('request failed');
  err.response = { data: { detail } } as AxiosError['response'];
  return err;
}

// ----- Fixtures -----

const MECHANIC_DAVID_ID = 5;
const MECHANIC_YOSSI_ID = 9;

function makeUser(role: Role, id = 1): User {
  return {
    id,
    username: 'u',
    full_name: 'משתמש',
    email: null,
    role,
    is_active: true,
  };
}

function makeTicket(overrides: Partial<KanbanTicket>): KanbanTicket {
  return {
    id: 0,
    ticket_number: 'TKT-00000',
    vehicle_id: 1,
    created_by_id: 1,
    assigned_mechanic_id: MECHANIC_DAVID_ID,
    description: 'תיאור',
    status: 'Pending',
    created_at: '2026-06-01T08:00:00Z',
    started_at: null,
    completed_at: null,
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

// Two of David's tickets (one per active column), plus one belonging to another
// mechanic — used to prove role-based visibility.
const T_PENDING = makeTicket({ id: 1, status: 'Pending', license_plate: '11-111-11' });
const T_IN_PROGRESS = makeTicket({ id: 2, status: 'In Progress', license_plate: '22-222-22' });
const T_COMPLETED = makeTicket({ id: 3, status: 'Completed', license_plate: '33-333-33' });
const T_OTHER_MECHANIC = makeTicket({
  id: 4,
  status: 'Pending',
  license_plate: '44-444-44',
  assigned_mechanic_id: MECHANIC_YOSSI_ID,
  mechanic_name: 'יוסי',
});

const ALL_TICKETS = [T_PENDING, T_IN_PROGRESS, T_COMPLETED, T_OTHER_MECHANIC];

function renderBoard(user: User) {
  return render(<KanbanBoard user={user} />);
}

const region = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listTickets).mockResolvedValue(ALL_TICKETS);
});

describe('KanbanBoard — layout', () => {
  it('renders the three status columns', async () => {
    renderBoard(makeUser('Manager'));

    expect(await screen.findByRole('region', { name: 'ממתין לטיפול' })).toBeInTheDocument();
    expect(region('בטיפול')).toBeInTheDocument();
    expect(region('הושלם')).toBeInTheDocument();
  });

  it('places each ticket in the column matching its status', async () => {
    renderBoard(makeUser('Manager'));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    expect(within(region('ממתין לטיפול')).getByText('11-111-11')).toBeInTheDocument();
    expect(within(region('ממתין לטיפול')).getByText('44-444-44')).toBeInTheDocument();
    expect(within(region('בטיפול')).getByText('22-222-22')).toBeInTheDocument();
    expect(within(region('הושלם')).getByText('33-333-33')).toBeInTheDocument();
  });

  it('shows the correct count in each column counter', async () => {
    renderBoard(makeUser('Manager'));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    expect(within(region('ממתין לטיפול')).getByLabelText('2 קריאות')).toBeInTheDocument();
    expect(within(region('בטיפול')).getByLabelText('1 קריאות')).toBeInTheDocument();
    expect(within(region('הושלם')).getByLabelText('1 קריאות')).toBeInTheDocument();
  });

  it('shows each card details: plate, description, mechanic name and status badge', async () => {
    renderBoard(makeUser('Manager'));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    const card = within(region('ממתין לטיפול')).getByText('11-111-11').closest('article')!;
    expect(within(card).getByText('תיאור')).toBeInTheDocument();
    expect(within(card).getByText('מכונאי: דוד')).toBeInTheDocument();
    expect(within(card).getByText('ממתין לטיפול')).toBeInTheDocument();
  });
});

describe('KanbanBoard — status filter', () => {
  it('shows only the selected status column when filtering', async () => {
    renderBoard(makeUser('Manager'));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    await userEvent.click(screen.getByRole('button', { name: 'בטיפול' }));

    expect(region('בטיפול')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'ממתין לטיפול' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'הושלם' })).not.toBeInTheDocument();
    expect(screen.getByText('22-222-22')).toBeInTheDocument();
    expect(screen.queryByText('11-111-11')).not.toBeInTheDocument();
  });

  it('returns to all columns when selecting "הכל"', async () => {
    renderBoard(makeUser('Manager'));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    await userEvent.click(screen.getByRole('button', { name: 'הושלם' }));
    expect(screen.queryByRole('region', { name: 'ממתין לטיפול' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'הכל' }));
    expect(region('ממתין לטיפול')).toBeInTheDocument();
    expect(region('בטיפול')).toBeInTheDocument();
    expect(region('הושלם')).toBeInTheDocument();
  });
});

describe('KanbanBoard — status transitions', () => {
  it('"קבל" advances a Pending ticket to In Progress', async () => {
    vi.mocked(updateTicketStatus).mockResolvedValue(
      makeTicket({ id: 1, status: 'In Progress', license_plate: '11-111-11' })
    );
    renderBoard(makeUser('Mechanic', MECHANIC_DAVID_ID));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    await userEvent.click(screen.getByRole('button', { name: 'התחל טיפול' }));

    expect(updateTicketStatus).toHaveBeenCalledWith(1, 'In Progress', false);
    await waitFor(() =>
      expect(within(region('בטיפול')).getByText('11-111-11')).toBeInTheDocument()
    );
    expect(within(region('ממתין לטיפול')).queryByText('11-111-11')).not.toBeInTheDocument();
  });

  it('"סיים טיפול" requires explicit confirmation before completing', async () => {
    vi.mocked(updateTicketStatus).mockResolvedValue(
      makeTicket({ id: 2, status: 'Completed', license_plate: '22-222-22' })
    );
    renderBoard(makeUser('Mechanic', MECHANIC_DAVID_ID));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    await userEvent.click(screen.getByRole('button', { name: 'סיים טיפול' }));

    // The dialog is shown and nothing is sent until the user confirms.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(updateTicketStatus).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'סיים טיפול' }));

    expect(updateTicketStatus).toHaveBeenCalledWith(2, 'Completed', true);
  });

  it('does not complete a ticket if the confirmation is cancelled', async () => {
    renderBoard(makeUser('Mechanic', MECHANIC_DAVID_ID));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    await userEvent.click(screen.getByRole('button', { name: 'סיים טיפול' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ביטול' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(updateTicketStatus).not.toHaveBeenCalled();
  });

  it('Completed tickets have no status-advance button (only the close button)', async () => {
    renderBoard(makeUser('Mechanic', MECHANIC_DAVID_ID));
    await screen.findByRole('region', { name: 'הושלם' });

    // No "התחל טיפול"/"סיים טיפול" advance action on a completed card.
    expect(within(region('הושלם')).queryByRole('button', { name: 'התחל טיפול' })).not.toBeInTheDocument();
    expect(within(region('הושלם')).queryByRole('button', { name: 'סיים טיפול' })).not.toBeInTheDocument();
  });
});

describe('KanbanBoard — archive (close) completed tickets', () => {
  it('shows "סגור כרטיס" only on Completed tickets', async () => {
    renderBoard(makeUser('Manager'));
    await screen.findByRole('region', { name: 'הושלם' });

    // The completed column's card has the close button.
    expect(within(region('הושלם')).getByRole('button', { name: 'סגור כרטיס' })).toBeInTheDocument();
    // Pending / In Progress cards never show it.
    expect(within(region('ממתין לטיפול')).queryByRole('button', { name: 'סגור כרטיס' })).not.toBeInTheDocument();
    expect(within(region('בטיפול')).queryByRole('button', { name: 'סגור כרטיס' })).not.toBeInTheDocument();
  });

  it('clicking "סגור כרטיס" archives the ticket and removes it from the board', async () => {
    vi.mocked(archiveTicket).mockResolvedValue(
      makeTicket({ id: 3, status: 'Completed', license_plate: '33-333-33', archived_at: '2026-06-18T10:00:00Z' })
    );
    renderBoard(makeUser('Manager'));
    await screen.findByRole('region', { name: 'הושלם' });

    expect(within(region('הושלם')).getByText('33-333-33')).toBeInTheDocument();
    await userEvent.click(within(region('הושלם')).getByRole('button', { name: 'סגור כרטיס' }));

    expect(archiveTicket).toHaveBeenCalledWith(3);
    await waitFor(() =>
      expect(within(region('הושלם')).queryByText('33-333-33')).not.toBeInTheDocument()
    );
    expect(screen.getByText('✓ הכרטיס נסגר ונשמר בהיסטוריה.')).toBeInTheDocument();
  });

  it('shows a Hebrew error when the backend rejects the close with 409', async () => {
    vi.mocked(archiveTicket).mockRejectedValueOnce(
      axiosError('Only a completed ticket can be archived.')
    );
    renderBoard(makeUser('Manager'));
    await screen.findByRole('region', { name: 'הושלם' });

    await userEvent.click(within(region('הושלם')).getByRole('button', { name: 'סגור כרטיס' }));

    expect(await screen.findByText('ניתן לסגור רק כרטיסים שהושלמו.')).toBeInTheDocument();
    // The ticket stays on the board since it was not archived.
    expect(within(region('הושלם')).getByText('33-333-33')).toBeInTheDocument();
  });

  it('a Mechanic can close their own completed ticket', async () => {
    vi.mocked(archiveTicket).mockResolvedValue(
      makeTicket({ id: 3, status: 'Completed', license_plate: '33-333-33' })
    );
    renderBoard(makeUser('Mechanic', MECHANIC_DAVID_ID));
    await screen.findByRole('region', { name: 'הושלם' });

    await userEvent.click(within(region('הושלם')).getByRole('button', { name: 'סגור כרטיס' }));
    expect(archiveTicket).toHaveBeenCalledWith(3);
  });
});

describe('KanbanBoard — role-based visibility', () => {
  it('Manager sees all tickets, including other mechanics', async () => {
    renderBoard(makeUser('Manager'));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    for (const plate of ['11-111-11', '22-222-22', '33-333-33', '44-444-44']) {
      expect(screen.getByText(plate)).toBeInTheDocument();
    }
  });

  it('Secretary sees all tickets, including other mechanics', async () => {
    renderBoard(makeUser('Secretary'));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    for (const plate of ['11-111-11', '22-222-22', '33-333-33', '44-444-44']) {
      expect(screen.getByText(plate)).toBeInTheDocument();
    }
  });

  it('Mechanic sees only tickets assigned to them', async () => {
    renderBoard(makeUser('Mechanic', MECHANIC_DAVID_ID));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    expect(screen.getByText('11-111-11')).toBeInTheDocument();
    expect(screen.getByText('22-222-22')).toBeInTheDocument();
    expect(screen.getByText('33-333-33')).toBeInTheDocument();
    // Another mechanic's ticket must not be visible.
    expect(screen.queryByText('44-444-44')).not.toBeInTheDocument();
  });

  it('Mechanic cannot act on tickets that are not assigned to them', async () => {
    renderBoard(makeUser('Mechanic', MECHANIC_DAVID_ID));
    await screen.findByRole('region', { name: 'ממתין לטיפול' });

    // Only their own Pending ticket exposes a "קבל" button; the other
    // mechanic's Pending ticket is neither shown nor actionable.
    const acceptButtons = screen.getAllByRole('button', { name: 'התחל טיפול' });
    expect(acceptButtons).toHaveLength(1);
    const card = within(region('ממתין לטיפול')).getByText('11-111-11').closest('article')!;
    expect(within(card).getByRole('button', { name: 'התחל טיפול' })).toBeInTheDocument();
  });
});

describe('KanbanBoard — states', () => {
  it('shows a Hebrew loading state before tickets arrive', () => {
    vi.mocked(listTickets).mockReturnValue(new Promise(() => {})); // never resolves
    renderBoard(makeUser('Manager'));

    expect(screen.getByText('טוען קריאות...')).toBeInTheDocument();
  });

  it('shows a Hebrew empty state when there are no tickets', async () => {
    vi.mocked(listTickets).mockResolvedValue([]);
    renderBoard(makeUser('Manager'));

    expect(await screen.findByText('אין קריאות להצגה')).toBeInTheDocument();
  });

  it('shows a Hebrew error state with retry when loading fails', async () => {
    vi.mocked(listTickets).mockRejectedValueOnce(new Error('network'));
    renderBoard(makeUser('Manager'));

    expect(await screen.findByRole('alert')).toHaveTextContent('שגיאה בטעינת הקריאות. נסה שוב.');
    expect(screen.getByRole('button', { name: 'נסה שוב' })).toBeInTheDocument();

    // Retry re-fetches and renders the board.
    vi.mocked(listTickets).mockResolvedValue(ALL_TICKETS);
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByRole('region', { name: 'ממתין לטיפול' })).toBeInTheDocument();
  });
});
