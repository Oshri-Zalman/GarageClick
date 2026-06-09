import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import KanbanPage from '../pages/KanbanPage';
import type { KanbanTicket, Mechanic, User, VehicleSearchHit } from '../types';

vi.mock('../services/vehicles', () => ({ searchVehicle: vi.fn() }));
vi.mock('../services/mechanics', () => ({ listMechanics: vi.fn() }));
vi.mock('../services/tickets', () => ({
  listTickets: vi.fn().mockResolvedValue([]),
  updateTicketStatus: vi.fn(),
  createTicket: vi.fn(),
}));

import { searchVehicle } from '../services/vehicles';
import { listMechanics } from '../services/mechanics';
import { createTicket, listTickets } from '../services/tickets';

let mockUser: User;
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, loading: false, error: null }),
}));

const MANAGER: User = { id: 1, username: 'uri', full_name: 'אורי', email: null, role: 'Manager', is_active: true };
const SECRETARY: User = { id: 2, username: 'sara', full_name: 'שרה', email: null, role: 'Secretary', is_active: true };
const MECHANIC: User = { id: 5, username: 'david', full_name: 'דוד', email: null, role: 'Mechanic', is_active: true };

const MECHANICS: Mechanic[] = [
  { id: 5, name: 'דוד', role: 'Mechanic' },
  { id: 6, name: 'יוסי', role: 'Mechanic' },
];

const VEHICLE_HIT: VehicleSearchHit = {
  vehicle_id: 50,
  license_plate: 'VW-1234',
  manufacturer: 'Volkswagen',
  model: 'Golf',
  year: 2018,
  customer_id: 10,
  customer_name: 'דן',
  customer_phone: '0501234567',
};

const CREATED_TICKET = {
  id: 99,
  ticket_number: 'TKT-00099',
  vehicle_id: 50,
  manufacturer: 'Volkswagen',
  model: 'Golf',
  license_plate: 'VW-1234',
  customer_name: 'דן',
} as KanbanTicket;

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={['/kanban']}>
      <Routes>
        <Route path="/kanban" element={<KanbanPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function openModal() {
  await userEvent.click(screen.getByRole('button', { name: /פתיחת כרטיס עבודה חדש/ }));
  return screen.findByRole('dialog');
}

async function searchPlate(plate = 'vw-1234') {
  await userEvent.type(screen.getByLabelText('מספר רכב'), plate);
  await userEvent.click(screen.getByRole('button', { name: /חפש/ }));
}

describe('New Ticket modal on the Work Board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = MANAGER;
    vi.mocked(listMechanics).mockResolvedValue(MECHANICS);
    vi.mocked(listTickets).mockResolvedValue([]);
  });

  it('opens the modal with the Hebrew title and the board stays mounted behind', async () => {
    renderBoard();
    await openModal();

    expect(screen.getByRole('heading', { name: 'פתיחת כרטיס עבודה חדש' })).toBeInTheDocument();
    // Board heading is still present behind the modal.
    expect(screen.getByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
  });

  it('closes via the close button and does not create a ticket', async () => {
    renderBoard();
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: 'סגירה' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createTicket).not.toHaveBeenCalled();
  });

  it('closes on Escape and does not create a ticket', async () => {
    renderBoard();
    await openModal();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createTicket).not.toHaveBeenCalled();
  });

  it('creates an existing-vehicle ticket from inside the modal', async () => {
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    vi.mocked(createTicket).mockResolvedValueOnce(CREATED_TICKET);
    renderBoard();
    await openModal();
    await searchPlate();

    await screen.findByTestId('existing-vehicle-summary');
    await within(screen.getByLabelText('עובד מטפל')).findByRole('option', { name: 'דוד' });
    await userEvent.selectOptions(screen.getByLabelText('עובד מטפל'), '5');
    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת בלמים');
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    expect(createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ vehicle_id: 50, assigned_mechanic_id: 5, description: 'החלפת בלמים' })
    );
    expect(await screen.findByText('הכרטיס נפתח בהצלחה')).toBeInTheDocument();
  });

  it('creates a new customer/vehicle ticket from inside the modal', async () => {
    vi.mocked(searchVehicle).mockResolvedValueOnce(null);
    vi.mocked(createTicket).mockResolvedValueOnce(CREATED_TICKET);
    renderBoard();
    await openModal();
    await searchPlate('zz-9999');
    await screen.findByText(/לא נמצא במערכת/);

    await userEvent.type(screen.getByLabelText('שם מלא'), 'דוד');
    await userEvent.type(screen.getByLabelText('טלפון'), '0509876543');
    await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'BMW');
    await userEvent.type(screen.getByLabelText('דגם'), '320i');
    await userEvent.type(screen.getByLabelText('שנה'), '2020');
    await within(screen.getByLabelText('עובד מטפל')).findByRole('option', { name: 'דוד' });
    await userEvent.selectOptions(screen.getByLabelText('עובד מטפל'), '5');
    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת שמן');
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    expect(createTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        license_plate: 'ZZ-9999',
        new_customer: { full_name: 'דוד', phone_number: '0509876543' },
        new_vehicle: { manufacturer: 'BMW', model: '320i', year: 2020 },
        assigned_mechanic_id: 5,
      })
    );
    expect(await screen.findByText('הכרטיס נפתח בהצלחה')).toBeInTheDocument();
  });

  it('auto-assigns a Mechanic and shows no dropdown inside the modal', async () => {
    mockUser = MECHANIC;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    vi.mocked(createTicket).mockResolvedValueOnce(CREATED_TICKET);
    renderBoard();
    await openModal();
    await searchPlate();
    await screen.findByTestId('existing-vehicle-summary');

    expect(screen.queryByLabelText('עובד מטפל')).not.toBeInTheDocument();
    expect(screen.getByTestId('auto-assigned-mechanic')).toHaveTextContent('דוד (אתה)');

    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת בלמים');
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));
    expect(createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_mechanic_id: 5 })
    );
  });

  it('shows the assignment dropdown for a Manager inside the modal', async () => {
    mockUser = MANAGER;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    renderBoard();
    await openModal();
    await searchPlate();
    await screen.findByTestId('existing-vehicle-summary');

    const select = screen.getByLabelText('עובד מטפל');
    expect(await within(select).findByRole('option', { name: 'דוד' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'יוסי' })).toBeInTheDocument();
  });

  it('shows the assignment dropdown for a Secretary inside the modal', async () => {
    mockUser = SECRETARY;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    renderBoard();
    await openModal();
    await searchPlate();
    await screen.findByTestId('existing-vehicle-summary');

    const select = screen.getByLabelText('עובד מטפל');
    expect(await within(select).findByRole('option', { name: 'דוד' })).toBeInTheDocument();
  });

  it('returns to the work board after a successful creation and refreshes it', async () => {
    mockUser = MECHANIC;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    vi.mocked(createTicket).mockResolvedValueOnce(CREATED_TICKET);
    renderBoard();
    const initialFetches = vi.mocked(listTickets).mock.calls.length;

    await openModal();
    await searchPlate();
    await screen.findByTestId('existing-vehicle-summary');
    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת בלמים');
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    const back = await screen.findByRole('button', { name: 'חזרה ללוח העבודה' });
    await userEvent.click(back);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
    // The board was refreshed (remounted) after the ticket was created.
    expect(vi.mocked(listTickets).mock.calls.length).toBeGreaterThan(initialFetches);
  });
});
