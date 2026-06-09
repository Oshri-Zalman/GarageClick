import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NewTicketPage from '../pages/NewTicketPage';
import type { KanbanTicket, Mechanic, User, VehicleSearchHit } from '../types';

vi.mock('../services/vehicles', () => ({ searchVehicle: vi.fn() }));
vi.mock('../services/mechanics', () => ({ listMechanics: vi.fn() }));
vi.mock('../services/tickets', () => ({ createTicket: vi.fn() }));

import { searchVehicle } from '../services/vehicles';
import { listMechanics } from '../services/mechanics';
import { createTicket } from '../services/tickets';

// useAuth reads the current user; swap the user per test via this mutable ref.
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
  license_plate: '123-45-678',
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
  license_plate: '123-45-678',
  customer_name: 'דן',
} as KanbanTicket;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tickets/new']}>
      <Routes>
        <Route path="/tickets/new" element={<NewTicketPage />} />
        <Route path="/kanban" element={<div>לוח עבודה</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// Types a plate and triggers the search, returning after the async lookup
// resolves into the next stage.
async function doSearch(plate = '123-45-678') {
  await userEvent.type(screen.getByLabelText('מספר רכב'), plate);
  await userEvent.click(screen.getByRole('button', { name: /חפש/ }));
}

describe('NewTicketPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = MANAGER;
    vi.mocked(listMechanics).mockResolvedValue(MECHANICS);
  });

  it('auto-fills customer/vehicle details when the plate is found', async () => {
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    renderPage();
    await doSearch();

    const summary = await screen.findByTestId('existing-vehicle-summary');
    expect(within(summary).getByText('דן')).toBeInTheDocument();
    expect(within(summary).getByText('0501234567')).toBeInTheDocument();
    expect(within(summary).getByText('Volkswagen')).toBeInTheDocument();
    expect(within(summary).getByText('Golf')).toBeInTheDocument();
    expect(within(summary).getByText('2018')).toBeInTheDocument();
  });

  it('shows the new customer/vehicle form when the plate is not found', async () => {
    vi.mocked(searchVehicle).mockResolvedValueOnce(null);
    renderPage();
    await doSearch('999-999');

    expect(await screen.findByText(/לא נמצא במערכת/)).toBeInTheDocument();
    expect(screen.getByLabelText('שם מלא')).toBeInTheDocument();
    expect(screen.getByLabelText('טלפון')).toBeInTheDocument();
    expect(screen.getByLabelText('יצרן')).toBeInTheDocument();
  });

  it('shows validation errors when required fields are missing', async () => {
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    renderPage();
    await doSearch();
    await screen.findByTestId('existing-vehicle-summary');

    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    expect(await screen.findByText('יש להזין תיאור תקלה')).toBeInTheDocument();
    expect(screen.getByText('יש לבחור עובד מטפל')).toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it('auto-assigns the current user when the role is Mechanic', async () => {
    mockUser = MECHANIC;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    vi.mocked(createTicket).mockResolvedValueOnce(CREATED_TICKET);
    renderPage();
    await doSearch();
    await screen.findByTestId('existing-vehicle-summary');

    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת בלמים');
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    expect(createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ vehicle_id: 50, assigned_mechanic_id: 5, description: 'החלפת בלמים' })
    );
  });

  it('does not show a mechanic dropdown for a Mechanic', async () => {
    mockUser = MECHANIC;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    renderPage();
    await doSearch();
    await screen.findByTestId('existing-vehicle-summary');

    expect(screen.queryByLabelText('עובד מטפל')).not.toBeInTheDocument();
    expect(screen.getByTestId('auto-assigned-mechanic')).toHaveTextContent('דוד (אתה)');
  });

  it('shows the mechanic dropdown for a Manager', async () => {
    mockUser = MANAGER;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    renderPage();
    await doSearch();
    await screen.findByTestId('existing-vehicle-summary');

    const select = screen.getByLabelText('עובד מטפל');
    expect(select).toBeInTheDocument();
    expect(await within(select).findByRole('option', { name: 'דוד' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'יוסי' })).toBeInTheDocument();
  });

  it('shows the mechanic dropdown for a Secretary', async () => {
    mockUser = SECRETARY;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    renderPage();
    await doSearch();
    await screen.findByTestId('existing-vehicle-summary');

    const select = screen.getByLabelText('עובד מטפל');
    expect(select).toBeInTheDocument();
    expect(await within(select).findByRole('option', { name: 'דוד' })).toBeInTheDocument();
  });

  it('submits an existing-vehicle ticket and shows the success summary', async () => {
    mockUser = MANAGER;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    vi.mocked(createTicket).mockResolvedValueOnce(CREATED_TICKET);
    renderPage();
    await doSearch();
    await screen.findByTestId('existing-vehicle-summary');

    await within(screen.getByLabelText('עובד מטפל')).findByRole('option', { name: 'דוד' });
    await userEvent.selectOptions(screen.getByLabelText('עובד מטפל'), '5');
    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת בלמים');
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    expect(createTicket).toHaveBeenCalledWith({
      vehicle_id: 50,
      assigned_mechanic_id: 5,
      description: 'החלפת בלמים',
      estimated_completion_time: null,
      parts: [],
    });
    expect(await screen.findByText('הכרטיס נפתח בהצלחה')).toBeInTheDocument();
    expect(screen.getByText('TKT-00099')).toBeInTheDocument();
  });

  it('submits a new customer + vehicle ticket', async () => {
    mockUser = MANAGER;
    vi.mocked(searchVehicle).mockResolvedValueOnce(null);
    vi.mocked(createTicket).mockResolvedValueOnce(CREATED_TICKET);
    renderPage();
    await doSearch('999-999');
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

    expect(createTicket).toHaveBeenCalledWith({
      license_plate: '999-999',
      new_customer: { full_name: 'דוד', phone_number: '0509876543' },
      new_vehicle: { manufacturer: 'BMW', model: '320i', year: 2020 },
      assigned_mechanic_id: 5,
      description: 'החלפת שמן',
      estimated_completion_time: null,
      parts: [],
    });
    expect(await screen.findByText('הכרטיס נפתח בהצלחה')).toBeInTheDocument();
  });

  it('shows an error state when ticket creation fails', async () => {
    mockUser = MECHANIC;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    vi.mocked(createTicket).mockRejectedValueOnce(new Error('500'));
    renderPage();
    await doSearch();
    await screen.findByTestId('existing-vehicle-summary');

    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת בלמים');
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    expect(await screen.findByText(/שגיאה בפתיחת הכרטיס/)).toBeInTheDocument();
    expect(screen.queryByText('הכרטיס נפתח בהצלחה')).not.toBeInTheDocument();
  });

  it('shows the Hebrew search-error message when the lookup fails', async () => {
    vi.mocked(searchVehicle).mockRejectedValueOnce(new Error('network'));
    renderPage();
    await doSearch();

    expect(await screen.findByText(/שגיאה בחיפוש הרכב/)).toBeInTheDocument();
    // The flow stays on the search step — no ticket form appears.
    expect(screen.queryByTestId('existing-vehicle-summary')).not.toBeInTheDocument();
  });

  it('requires a license plate before searching', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /חפש/ }));

    expect(await screen.findByText('יש להזין מספר רכב')).toBeInTheDocument();
    expect(searchVehicle).not.toHaveBeenCalled();
  });

  describe('new customer/vehicle field validation', () => {
    async function reachNewForm() {
      vi.mocked(searchVehicle).mockResolvedValueOnce(null);
      renderPage();
      await doSearch('999-999');
      await screen.findByText(/לא נמצא במערכת/);
    }

    it('flags every required field when the form is empty', async () => {
      mockUser = MANAGER;
      await reachNewForm();
      await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

      expect(await screen.findByText('יש להזין שם לקוח')).toBeInTheDocument();
      expect(screen.getByText('יש להזין מספר טלפון')).toBeInTheDocument();
      expect(screen.getByText('יש לבחור יצרן')).toBeInTheDocument();
      expect(screen.getByText('יש להזין דגם')).toBeInTheDocument();
      expect(screen.getByText('יש להזין שנה')).toBeInTheDocument();
      expect(screen.getByText('יש לבחור עובד מטפל')).toBeInTheDocument();
      expect(screen.getByText('יש להזין תיאור תקלה')).toBeInTheDocument();
      expect(createTicket).not.toHaveBeenCalled();
    });

    it('rejects a phone number that is not 9–15 digits', async () => {
      mockUser = MECHANIC; // skip the mechanic dropdown to isolate the phone rule
      await reachNewForm();

      await userEvent.type(screen.getByLabelText('שם מלא'), 'דוד');
      await userEvent.type(screen.getByLabelText('טלפון'), '123');
      await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'BMW');
      await userEvent.type(screen.getByLabelText('דגם'), '320i');
      await userEvent.type(screen.getByLabelText('שנה'), '2020');
      await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת שמן');
      await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

      expect(await screen.findByText('מספר טלפון חייב להכיל 9 עד 15 ספרות')).toBeInTheDocument();
      expect(createTicket).not.toHaveBeenCalled();
    });

    it('accepts a valid 9–15 digit phone number', async () => {
      mockUser = MECHANIC;
      vi.mocked(createTicket).mockResolvedValueOnce(CREATED_TICKET);
      await reachNewForm();

      await userEvent.type(screen.getByLabelText('שם מלא'), 'דוד');
      await userEvent.type(screen.getByLabelText('טלפון'), '050-987-6543');
      await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'BMW');
      await userEvent.type(screen.getByLabelText('דגם'), '320i');
      await userEvent.type(screen.getByLabelText('שנה'), '2020');
      await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת שמן');
      await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

      expect(await screen.findByText('הכרטיס נפתח בהצלחה')).toBeInTheDocument();
      expect(screen.queryByText('מספר טלפון חייב להכיל 9 עד 15 ספרות')).not.toBeInTheDocument();
    });

    it('rejects a year outside 1900..currentYear+1', async () => {
      mockUser = MECHANIC;
      await reachNewForm();

      await userEvent.type(screen.getByLabelText('שם מלא'), 'דוד');
      await userEvent.type(screen.getByLabelText('טלפון'), '0509876543');
      await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'BMW');
      await userEvent.type(screen.getByLabelText('דגם'), '320i');
      await userEvent.type(screen.getByLabelText('שנה'), '3000');
      await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת שמן');
      await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

      expect(await screen.findByText(/שנה חייבת להיות בין 1900/)).toBeInTheDocument();
      expect(createTicket).not.toHaveBeenCalled();
    });
  });

  it('links back to the work board after a successful creation', async () => {
    mockUser = MECHANIC;
    vi.mocked(searchVehicle).mockResolvedValueOnce(VEHICLE_HIT);
    vi.mocked(createTicket).mockResolvedValueOnce(CREATED_TICKET);
    renderPage();
    await doSearch();
    await screen.findByTestId('existing-vehicle-summary');

    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת בלמים');
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    const backLink = await screen.findByRole('link', { name: 'חזרה ללוח העבודה' });
    expect(backLink).toHaveAttribute('href', '/kanban');
    await userEvent.click(backLink);
    expect(await screen.findByText('לוח עבודה')).toBeInTheDocument();
  });
});
