import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import CustomersPage from '../pages/CustomersPage';
import type { CustomerDetail, User } from '../types';

vi.mock('../services/customers', () => ({
  searchCustomersByPlate: vi.fn(),
  searchCustomersByPhone: vi.fn(),
  getCustomer: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));
vi.mock('../services/vehicles', () => ({
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
}));
// The vehicle form's manufacturer/model fields load the catalog; stub it so the
// tests stay offline. The static fallback list still covers the makes used here.
vi.mock('../services/catalog', () => ({
  getManufacturers: vi.fn().mockResolvedValue(['BMW', 'Toyota', 'Volkswagen']),
  getModels: vi.fn().mockResolvedValue(['Golf', '320i']),
}));

import {
  searchCustomersByPlate,
  searchCustomersByPhone,
  getCustomer,
  createCustomer,
  updateCustomer,
} from '../services/customers';
import { createVehicle, updateVehicle } from '../services/vehicles';

// Builds an AxiosError carrying a backend `detail`, like the real api client.
function axiosError(detail: string): AxiosError {
  const err = new AxiosError('request failed');
  err.response = { data: { detail } } as AxiosError['response'];
  return err;
}

// useAuth reads the current user; swap it per test via this mutable ref.
let mockUser: User;
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, loading: false, error: null }),
}));

const MANAGER: User = { id: 1, username: 'uri', full_name: 'אורי', email: null, role: 'Manager', is_active: true };
const SECRETARY: User = { id: 2, username: 'sara', full_name: 'שרה', email: null, role: 'Secretary', is_active: true };

const DETAIL: CustomerDetail = {
  id: 10,
  full_name: 'דן כהן',
  phone_number: '0501234567',
  vehicles: [
    { id: 1, license_plate: '12-345-67', manufacturer: 'Volkswagen', model: 'Golf', year: 2018 },
  ],
};

// The phone/plate search endpoints both return customers-with-vehicles
// (CustomerDetail[]); reuse DETAIL as the search hit fixture.
const SUMMARY: CustomerDetail = DETAIL;

function renderPage(user: User = MANAGER) {
  mockUser = user;
  return render(<CustomersPage />);
}

// Type a query into the search box (the only textbox before a customer loads).
async function search(query: string) {
  await userEvent.type(screen.getByRole('textbox'), query);
  await userEvent.click(screen.getByRole('button', { name: '🔍 חפש' }));
}

describe('CustomersPage — search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('searches by phone number and shows the matched customer detail', async () => {
    vi.mocked(searchCustomersByPhone).mockResolvedValue([SUMMARY]);
    vi.mocked(getCustomer).mockResolvedValue(DETAIL);
    renderPage();

    await search('0501234567');

    expect(searchCustomersByPhone).toHaveBeenCalledWith('0501234567');
    expect(await screen.findByRole('heading', { name: 'דן כהן' })).toBeInTheDocument();
  });

  it('searches by license plate and shows the customer with their vehicles', async () => {
    vi.mocked(searchCustomersByPlate).mockResolvedValue([DETAIL]);
    vi.mocked(getCustomer).mockResolvedValue(DETAIL);
    renderPage();

    await userEvent.click(screen.getByRole('radio', { name: 'מספר רכב' }));
    await search('12-345-67');

    expect(searchCustomersByPlate).toHaveBeenCalledWith('12-345-67');
    expect(await screen.findByRole('heading', { name: 'דן כהן' })).toBeInTheDocument();
    // Vehicle list renders the plate + make/model.
    const vehicles = await screen.findByRole('region', { name: 'רכבי הלקוח' });
    expect(within(vehicles).getByText('12-345-67')).toBeInTheDocument();
    expect(within(vehicles).getByText(/Volkswagen Golf/)).toBeInTheDocument();
  });

  it('shows an empty state when no customer matches', async () => {
    vi.mocked(searchCustomersByPhone).mockResolvedValue([]);
    renderPage();

    await search('000');

    expect(await screen.findByText('לא נמצאו תוצאות עבור החיפוש.')).toBeInTheDocument();
  });

  it('shows a Hebrew error state with retry when the search fails', async () => {
    vi.mocked(searchCustomersByPhone).mockRejectedValueOnce(new Error('500'));
    renderPage();

    await search('0501234567');

    expect(await screen.findByText('שגיאה בחיפוש. נסה שוב.')).toBeInTheDocument();

    // Retry now succeeds.
    vi.mocked(searchCustomersByPhone).mockResolvedValueOnce([SUMMARY]);
    vi.mocked(getCustomer).mockResolvedValueOnce(DETAIL);
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByRole('heading', { name: 'דן כהן' })).toBeInTheDocument();
  });

  it('blocks an empty search with an inline Hebrew message', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: '🔍 חפש' }));
    expect(await screen.findByText('יש להזין מספר טלפון')).toBeInTheDocument();
    expect(searchCustomersByPhone).not.toHaveBeenCalled();
  });
});

describe('CustomersPage — role-based edit access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchCustomersByPhone).mockResolvedValue([SUMMARY]);
    vi.mocked(getCustomer).mockResolvedValue(DETAIL);
  });

  it('a Manager sees customer + vehicle edit actions', async () => {
    renderPage(MANAGER);
    await search('0501234567');
    expect(await screen.findByRole('button', { name: '✏️ ערוך לקוח' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '➕ הוסף רכב' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ערוך רכב 12-345-67' })).toBeInTheDocument();
  });

  it('a Secretary sees customer + vehicle edit actions', async () => {
    renderPage(SECRETARY);
    await search('0501234567');
    expect(await screen.findByRole('button', { name: '✏️ ערוך לקוח' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '➕ הוסף רכב' })).toBeInTheDocument();
  });
});

describe('CustomersPage — create / edit customer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates the create-customer form before submit', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: '➕ לקוח חדש' }));
    await userEvent.click(screen.getByRole('button', { name: 'צור לקוח' }));

    expect(await screen.findByText('יש להזין שם לקוח')).toBeInTheDocument();
    expect(screen.getByText('יש להזין מספר טלפון')).toBeInTheDocument();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('creates a customer successfully', async () => {
    vi.mocked(createCustomer).mockResolvedValue({ id: 11, full_name: 'נועה', phone_number: '0521112233' });
    vi.mocked(getCustomer).mockResolvedValue({ id: 11, full_name: 'נועה', phone_number: '0521112233', vehicles: [] });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: '➕ לקוח חדש' }));
    await userEvent.type(screen.getByLabelText('שם מלא'), 'נועה');
    await userEvent.type(screen.getByLabelText('טלפון'), '052-111-2233');
    await userEvent.click(screen.getByRole('button', { name: 'צור לקוח' }));

    expect(createCustomer).toHaveBeenCalledWith({ full_name: 'נועה', phone_number: '0521112233' });
    expect(await screen.findByText('✓ הלקוח נוצר בהצלחה.')).toBeInTheDocument();
  });

  it('validates the edit-customer form and updates successfully', async () => {
    vi.mocked(searchCustomersByPhone).mockResolvedValue([SUMMARY]);
    vi.mocked(getCustomer).mockResolvedValue(DETAIL);
    vi.mocked(updateCustomer).mockResolvedValue({ id: 10, full_name: 'דן לוי', phone_number: '0501234567' });
    renderPage();

    await search('0501234567');
    await userEvent.click(await screen.findByRole('button', { name: '✏️ ערוך לקוח' }));

    // Clearing the name blocks submit with a Hebrew message.
    await userEvent.clear(screen.getByLabelText('שם מלא'));
    await userEvent.click(screen.getByRole('button', { name: 'שמור שינויים' }));
    expect(await screen.findByText('יש להזין שם לקוח')).toBeInTheDocument();
    expect(updateCustomer).not.toHaveBeenCalled();

    // A valid name goes through.
    await userEvent.type(screen.getByLabelText('שם מלא'), 'דן לוי');
    await userEvent.click(screen.getByRole('button', { name: 'שמור שינויים' }));
    expect(updateCustomer).toHaveBeenCalledWith(10, { full_name: 'דן לוי', phone_number: '0501234567' });
    expect(await screen.findByText('✓ הלקוח עודכן בהצלחה.')).toBeInTheDocument();
  });
});

describe('CustomersPage — create vehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchCustomersByPhone).mockResolvedValue([SUMMARY]);
    vi.mocked(getCustomer).mockResolvedValue(DETAIL);
  });

  it('validates the create-vehicle form before submit', async () => {
    renderPage();
    await search('0501234567');
    await userEvent.click(await screen.findByRole('button', { name: '➕ הוסף רכב' }));
    const form = screen.getByRole('form', { name: 'רכב חדש' });
    await userEvent.click(within(form).getByRole('button', { name: 'הוסף רכב' }));

    expect(await within(form).findByText('יש להזין מספר רכב')).toBeInTheDocument();
    expect(within(form).getByText('יש לבחור יצרן')).toBeInTheDocument();
    expect(within(form).getByText('יש להזין דגם')).toBeInTheDocument();
    expect(within(form).getByText('יש להזין שנה')).toBeInTheDocument();
    expect(createVehicle).not.toHaveBeenCalled();
  });

  it('adds a vehicle to the selected customer successfully', async () => {
    vi.mocked(createVehicle).mockResolvedValue({
      id: 2,
      customer_id: 10,
      license_plate: 'BM-5555',
      manufacturer: 'BMW',
      model: '320i',
      year: 2020,
    });
    renderPage();
    await search('0501234567');
    await userEvent.click(await screen.findByRole('button', { name: '➕ הוסף רכב' }));
    const form = screen.getByRole('form', { name: 'רכב חדש' });

    await userEvent.type(within(form).getByLabelText('מספר רכב'), 'BM-5555');
    await userEvent.selectOptions(within(form).getByLabelText('יצרן'), 'BMW');
    await userEvent.type(within(form).getByLabelText('דגם'), '320i');
    await userEvent.type(within(form).getByLabelText('שנה'), '2020');
    await userEvent.click(within(form).getByRole('button', { name: 'הוסף רכב' }));

    expect(createVehicle).toHaveBeenCalledWith(10, {
      license_plate: 'BM-5555',
      manufacturer: 'BMW',
      model: '320i',
      year: 2020,
    });
    expect(await screen.findByText('✓ הרכב נוסף בהצלחה.')).toBeInTheDocument();
  });

  it('shows a known backend error in Hebrew (duplicate plate)', async () => {
    vi.mocked(createVehicle).mockRejectedValueOnce(
      axiosError('A vehicle with this license_plate already exists.')
    );
    renderPage();
    await search('0501234567');
    await userEvent.click(await screen.findByRole('button', { name: '➕ הוסף רכב' }));
    const form = screen.getByRole('form', { name: 'רכב חדש' });

    await userEvent.type(within(form).getByLabelText('מספר רכב'), '12-345-67');
    await userEvent.selectOptions(within(form).getByLabelText('יצרן'), 'Volkswagen');
    await userEvent.type(within(form).getByLabelText('דגם'), 'Golf');
    await userEvent.type(within(form).getByLabelText('שנה'), '2018');
    await userEvent.click(within(form).getByRole('button', { name: 'הוסף רכב' }));

    expect(await screen.findByText('מספר רכב זה כבר קיים במערכת.')).toBeInTheDocument();
  });
});

describe('CustomersPage — edit vehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchCustomersByPhone).mockResolvedValue([SUMMARY]);
    vi.mocked(getCustomer).mockResolvedValue(DETAIL);
  });

  async function openEditVehicle() {
    renderPage();
    await search('0501234567');
    await userEvent.click(await screen.findByRole('button', { name: 'ערוך רכב 12-345-67' }));
    return screen.getByRole('form', { name: 'עריכת רכב' });
  }

  it('renders the edit-vehicle form prefilled from the vehicle list', async () => {
    const form = await openEditVehicle();
    expect(within(form).getByLabelText('מספר רכב')).toHaveValue('12-345-67');
    expect(within(form).getByLabelText('יצרן')).toHaveValue('Volkswagen');
    expect(within(form).getByLabelText('דגם')).toHaveValue('Golf');
    expect(within(form).getByLabelText('שנה')).toHaveValue('2018');
  });

  it('shows validation errors when a required field is cleared', async () => {
    const form = await openEditVehicle();
    await userEvent.clear(within(form).getByLabelText('מספר רכב'));
    await userEvent.click(within(form).getByRole('button', { name: 'שמור שינויים' }));

    expect(await within(form).findByText('יש להזין מספר רכב')).toBeInTheDocument();
    expect(updateVehicle).not.toHaveBeenCalled();
  });

  it('updates the vehicle successfully and reloads the customer detail', async () => {
    vi.mocked(updateVehicle).mockResolvedValue({
      id: 1,
      customer_id: 10,
      license_plate: '12-345-67',
      manufacturer: 'Volkswagen',
      model: 'Golf',
      year: 2019,
    });
    const form = await openEditVehicle();

    await userEvent.clear(within(form).getByLabelText('שנה'));
    await userEvent.type(within(form).getByLabelText('שנה'), '2019');
    await userEvent.click(within(form).getByRole('button', { name: 'שמור שינויים' }));

    expect(updateVehicle).toHaveBeenCalledWith(1, {
      license_plate: '12-345-67',
      manufacturer: 'Volkswagen',
      model: 'Golf',
      year: 2019,
    });
    // Detail is reloaded after the update (search load + post-update reload).
    expect(getCustomer).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('✓ הרכב עודכן בהצלחה.')).toBeInTheDocument();
  });
});

describe('CustomersPage — switching search type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchCustomersByPhone).mockResolvedValue([SUMMARY]);
    vi.mocked(searchCustomersByPlate).mockResolvedValue([DETAIL]);
    vi.mocked(getCustomer).mockResolvedValue(DETAIL);
  });

  it('clears the input when switching from phone to license plate', async () => {
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), '0501234567');
    await userEvent.click(screen.getByRole('radio', { name: 'מספר רכב' }));
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('clears the input when switching from license plate to phone', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'מספר רכב' }));
    await userEvent.type(screen.getByRole('textbox'), '12-345-67');
    await userEvent.click(screen.getByRole('radio', { name: 'מספר טלפון' }));
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('clears previous results and the selected customer when switching type', async () => {
    renderPage();
    await search('0501234567');
    expect(await screen.findByRole('heading', { name: 'דן כהן' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'מספר רכב' }));

    expect(screen.queryByRole('heading', { name: 'דן כהן' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'רכבי הלקוח' })).not.toBeInTheDocument();
  });

  it('clears a previous search error when switching type', async () => {
    vi.mocked(searchCustomersByPhone).mockRejectedValueOnce(new Error('500'));
    renderPage();
    await search('0501234567');
    expect(await screen.findByText('שגיאה בחיפוש. נסה שוב.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'מספר רכב' }));
    expect(screen.queryByText('שגיאה בחיפוש. נסה שוב.')).not.toBeInTheDocument();
  });
});
