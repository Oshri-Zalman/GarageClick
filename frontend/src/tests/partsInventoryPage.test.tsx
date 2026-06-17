import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import PartsPage from '../pages/PartsPage';
import App from '../App';
import type { Paginated, Part, User } from '../types';

vi.mock('../services/parts', () => ({
  getInventory: vi.fn(),
  createPart: vi.fn(),
  updatePart: vi.fn(),
  updatePartQuantity: vi.fn(),
}));

// The part form's manufacturer/model fields load the catalog; stub it so the
// tests stay offline (the static fallback list still covers the makes used here).
vi.mock('../services/catalog', () => ({
  getManufacturers: vi.fn().mockResolvedValue(['BMW', 'Toyota', 'Volkswagen']),
  getModels: vi.fn().mockResolvedValue(['Golf', 'Corolla', '320i']),
}));

// The Kanban board (the page a blocked mechanic is redirected to) fetches tickets
// on mount; stub the service so the role-access integration test never hits the
// network.
vi.mock('../services/tickets', () => ({
  listTickets: vi.fn().mockResolvedValue([]),
  updateTicketStatus: vi.fn(),
  archiveTicket: vi.fn(),
}));

import { getInventory, createPart, updatePart, updatePartQuantity } from '../services/parts';

// useAuth reads the current user; swap it per test via this mutable ref.
let mockUser: User;
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, loading: false, error: null }),
}));

function axiosError(detail: string): AxiosError {
  const err = new AxiosError('request failed');
  err.response = { data: { detail } } as AxiosError['response'];
  return err;
}

const MANAGER: User = { id: 1, username: 'uri', full_name: 'אורי', email: null, role: 'Manager', is_active: true };
const SECRETARY: User = { id: 2, username: 'sara', full_name: 'שרה', email: null, role: 'Secretary', is_active: true };
const MECHANIC: User = { id: 3, username: 'moshe', full_name: 'משה', email: null, role: 'Mechanic', is_active: true };

const PARTS: Part[] = [
  {
    id: 1,
    part_name: 'בלמים דיסק קדמי',
    part_code: 'BRK001',
    manufacturer: 'Volkswagen',
    model: 'Golf',
    year_start: 2015,
    quantity_current: 3,
  },
  {
    id: 2,
    part_name: 'מסנן שמן',
    part_code: 'OIL002',
    manufacturer: 'BMW',
    model: '320i',
    year_start: 2018,
    quantity_current: 0,
  },
];

// A universal / multi-vehicle part — no make/model/year (all null).
const UNIVERSAL_PART: Part = {
  id: 9,
  part_name: 'נורת חזית אוניברסלית',
  part_code: 'UNI009',
  manufacturer: null,
  model: null,
  year_start: null,
  quantity_current: 7,
};

// Wraps a list of parts in the standard paginated envelope the backend returns.
function envelope(items: Part[]): Paginated<Part> {
  return { items, page: 1, limit: 200, total: items.length };
}

function renderPage(user: User = MANAGER) {
  mockUser = user;
  return render(<PartsPage />);
}

describe('PartsPage — inventory list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the inventory table with the loaded parts', async () => {
    vi.mocked(getInventory).mockResolvedValue(envelope(PARTS));
    renderPage();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('בלמים דיסק קדמי')).toBeInTheDocument();
    expect(screen.getByText('מסנן שמן')).toBeInTheDocument();
    expect(screen.getByText('BRK001')).toBeInTheDocument();
    // First load fetches with no filters.
    expect(getInventory).toHaveBeenCalledWith({});
  });

  it('shows a Hebrew loading state while the inventory loads', () => {
    vi.mocked(getInventory).mockReturnValue(new Promise<Paginated<Part>>(() => {}));
    renderPage();
    expect(screen.getByText('טוען מלאי חלקים...')).toBeInTheDocument();
  });

  it('shows an empty state when there are no parts at all', async () => {
    vi.mocked(getInventory).mockResolvedValue(envelope([]));
    renderPage();
    expect(await screen.findByText('אין חלפים במלאי. הוסף חלף חדש כדי להתחיל.')).toBeInTheDocument();
  });

  it('shows a Hebrew error state with retry when loading fails', async () => {
    vi.mocked(getInventory).mockRejectedValueOnce(new Error('500'));
    renderPage();

    expect(await screen.findByText('שגיאה בטעינת המלאי. נסה שוב.')).toBeInTheDocument();

    vi.mocked(getInventory).mockResolvedValueOnce(envelope(PARTS));
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('renders an out-of-stock status when quantity_current is 0', async () => {
    vi.mocked(getInventory).mockResolvedValue(envelope(PARTS));
    renderPage();

    const row = (await screen.findByText('מסנן שמן')).closest('tr') as HTMLElement;
    expect(within(row).getByText('אזל מהמלאי')).toBeInTheDocument();
  });

  it('renders an available status when quantity_current is greater than 0', async () => {
    vi.mocked(getInventory).mockResolvedValue(envelope(PARTS));
    renderPage();

    const row = (await screen.findByText('בלמים דיסק קדמי')).closest('tr') as HTMLElement;
    expect(within(row).getByText('זמין')).toBeInTheDocument();
  });
});

describe('PartsPage — server-side search / filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInventory).mockResolvedValue(envelope(PARTS));
  });

  it('filters by manufacturer using a backend query (exact match)', async () => {
    renderPage();
    await screen.findByRole('table');

    vi.mocked(getInventory).mockResolvedValue(envelope([PARTS[1]]));
    await userEvent.type(screen.getByLabelText('יצרן'), 'BMW');

    expect(getInventory).toHaveBeenLastCalledWith({ manufacturer: 'BMW' });
    expect(await screen.findByText('מסנן שמן')).toBeInTheDocument();
    expect(screen.queryByText('בלמים דיסק קדמי')).not.toBeInTheDocument();
  });

  it('filters by model using a backend query', async () => {
    renderPage();
    await screen.findByRole('table');

    vi.mocked(getInventory).mockResolvedValue(envelope([PARTS[0]]));
    await userEvent.type(screen.getByLabelText('דגם'), 'Golf');

    expect(getInventory).toHaveBeenLastCalledWith({ model: 'Golf' });
    expect(await screen.findByText('בלמים דיסק קדמי')).toBeInTheDocument();
    expect(screen.queryByText('מסנן שמן')).not.toBeInTheDocument();
  });

  it('filters by part name using a backend query (partial)', async () => {
    renderPage();
    await screen.findByRole('table');

    vi.mocked(getInventory).mockResolvedValue(envelope([PARTS[1]]));
    await userEvent.type(screen.getByLabelText('שם חלף'), 'מסנן');

    expect(getInventory).toHaveBeenLastCalledWith({ part_name: 'מסנן' });
    expect(await screen.findByText('מסנן שמן')).toBeInTheDocument();
    expect(screen.queryByText('בלמים דיסק קדמי')).not.toBeInTheDocument();
  });

  it('filters by part code using a backend query (partial)', async () => {
    renderPage();
    await screen.findByRole('table');

    vi.mocked(getInventory).mockResolvedValue(envelope([PARTS[0]]));
    await userEvent.type(screen.getByLabelText('מק"ט'), 'BRK');

    expect(getInventory).toHaveBeenLastCalledWith({ part_code: 'BRK' });
    expect(await screen.findByText('בלמים דיסק קדמי')).toBeInTheDocument();
    expect(screen.queryByText('מסנן שמן')).not.toBeInTheDocument();
  });

  it('shows a no-match state when the backend returns nothing for an active filter', async () => {
    renderPage();
    await screen.findByRole('table');

    vi.mocked(getInventory).mockResolvedValue(envelope([]));
    await userEvent.type(screen.getByLabelText('שם חלף'), 'לא קיים');

    expect(await screen.findByText('לא נמצאו חלפים התואמים לסינון.')).toBeInTheDocument();
  });
});

describe('PartsPage — create part', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInventory).mockResolvedValue(envelope(PARTS));
  });

  it('validates the create-part form before submit', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '➕ חלף חדש' }));

    const form = screen.getByRole('form', { name: 'חלף חדש' });
    await userEvent.click(within(form).getByRole('button', { name: 'צור חלף' }));

    expect(await within(form).findByText('יש להזין שם חלף')).toBeInTheDocument();
    expect(within(form).getByText('יש להזין מק"ט')).toBeInTheDocument();
    expect(within(form).getByText('יש לבחור יצרן')).toBeInTheDocument();
    expect(within(form).getByText('יש להזין דגם')).toBeInTheDocument();
    expect(within(form).getByText('יש להזין שנה')).toBeInTheDocument();
    expect(within(form).getByText('יש להזין כמות')).toBeInTheDocument();
    expect(createPart).not.toHaveBeenCalled();
  });

  it('rejects a negative or non-integer quantity', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '➕ חלף חדש' }));
    const form = screen.getByRole('form', { name: 'חלף חדש' });

    await userEvent.type(within(form).getByLabelText('שם חלף'), 'רפידות');
    await userEvent.type(within(form).getByLabelText('מק"ט'), 'PAD003');
    await userEvent.selectOptions(within(form).getByLabelText('יצרן'), 'Toyota');
    await userEvent.type(within(form).getByLabelText('דגם'), 'Corolla');
    await userEvent.type(within(form).getByLabelText('שנת התחלה'), '2016');
    await userEvent.type(within(form).getByLabelText('כמות במלאי'), '-2');
    await userEvent.click(within(form).getByRole('button', { name: 'צור חלף' }));

    expect(await within(form).findByText('הכמות חייבת להיות מספר שלם אי-שלילי')).toBeInTheDocument();
    expect(createPart).not.toHaveBeenCalled();
  });

  it('creates a part successfully', async () => {
    vi.mocked(createPart).mockResolvedValue({
      id: 3,
      part_name: 'רפידות בלם',
      part_code: 'PAD003',
      manufacturer: 'Toyota',
      model: 'Corolla',
      year_start: 2016,
      quantity_current: 5,
    });
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '➕ חלף חדש' }));
    const form = screen.getByRole('form', { name: 'חלף חדש' });

    await userEvent.type(within(form).getByLabelText('שם חלף'), 'רפידות בלם');
    await userEvent.type(within(form).getByLabelText('מק"ט'), 'PAD003');
    await userEvent.selectOptions(within(form).getByLabelText('יצרן'), 'Toyota');
    await userEvent.type(within(form).getByLabelText('דגם'), 'Corolla');
    await userEvent.type(within(form).getByLabelText('שנת התחלה'), '2016');
    await userEvent.type(within(form).getByLabelText('כמות במלאי'), '5');
    await userEvent.click(within(form).getByRole('button', { name: 'צור חלף' }));

    expect(createPart).toHaveBeenCalledWith({
      part_name: 'רפידות בלם',
      part_code: 'PAD003',
      manufacturer: 'Toyota',
      model: 'Corolla',
      year_start: 2016,
      quantity_current: 5,
    });
    expect(await screen.findByText('✓ החלף נוצר בהצלחה.')).toBeInTheDocument();
  });

  it('maps a duplicate part_code backend error (409) to Hebrew', async () => {
    vi.mocked(createPart).mockRejectedValueOnce(axiosError('part_code already exists.'));
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '➕ חלף חדש' }));
    const form = screen.getByRole('form', { name: 'חלף חדש' });

    await userEvent.type(within(form).getByLabelText('שם חלף'), 'רפידות בלם');
    await userEvent.type(within(form).getByLabelText('מק"ט'), 'BRK001');
    await userEvent.selectOptions(within(form).getByLabelText('יצרן'), 'Toyota');
    await userEvent.type(within(form).getByLabelText('דגם'), 'Corolla');
    await userEvent.type(within(form).getByLabelText('שנת התחלה'), '2016');
    await userEvent.type(within(form).getByLabelText('כמות במלאי'), '5');
    await userEvent.click(within(form).getByRole('button', { name: 'צור חלף' }));

    expect(await within(form).findByText('מק״ט כבר קיים במערכת.')).toBeInTheDocument();
  });
});

describe('PartsPage — universal parts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInventory).mockResolvedValue(envelope(PARTS));
  });

  it('shows the "מתאים לכל הרכבים" checkbox on the create form', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '➕ חלף חדש' }));
    const form = screen.getByRole('form', { name: 'חלף חדש' });

    expect(within(form).getByRole('checkbox', { name: 'מתאים לכל הרכבים' })).not.toBeChecked();
    // Make/model/year fields are visible while it's a vehicle-specific part.
    expect(within(form).getByLabelText('יצרן')).toBeInTheDocument();
  });

  it('bypasses make/model/year validation and sends nulls for a universal part', async () => {
    vi.mocked(createPart).mockResolvedValue({ ...UNIVERSAL_PART });
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '➕ חלף חדש' }));
    const form = screen.getByRole('form', { name: 'חלף חדש' });

    // Mark it universal — the make/model/year fields disappear.
    await userEvent.click(within(form).getByRole('checkbox', { name: 'מתאים לכל הרכבים' }));
    expect(within(form).queryByLabelText('יצרן')).not.toBeInTheDocument();
    expect(within(form).queryByLabelText('דגם')).not.toBeInTheDocument();
    expect(within(form).queryByLabelText('שנת התחלה')).not.toBeInTheDocument();

    await userEvent.type(within(form).getByLabelText('שם חלף'), 'נורת חזית אוניברסלית');
    await userEvent.type(within(form).getByLabelText('מק"ט'), 'UNI009');
    await userEvent.type(within(form).getByLabelText('כמות במלאי'), '7');
    await userEvent.click(within(form).getByRole('button', { name: 'צור חלף' }));

    expect(createPart).toHaveBeenCalledWith({
      part_name: 'נורת חזית אוניברסלית',
      part_code: 'UNI009',
      manufacturer: null,
      model: null,
      year_start: null,
      quantity_current: 7,
    });
    expect(await screen.findByText('✓ החלף נוצר בהצלחה.')).toBeInTheDocument();
  });

  it('still requires make/model/year for a regular (non-universal) part', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '➕ חלף חדש' }));
    const form = screen.getByRole('form', { name: 'חלף חדש' });

    await userEvent.type(within(form).getByLabelText('שם חלף'), 'רפידות');
    await userEvent.type(within(form).getByLabelText('מק"ט'), 'PAD003');
    await userEvent.type(within(form).getByLabelText('כמות במלאי'), '5');
    await userEvent.click(within(form).getByRole('button', { name: 'צור חלף' }));

    expect(await within(form).findByText('יש לבחור יצרן')).toBeInTheDocument();
    expect(within(form).getByText('יש להזין דגם')).toBeInTheDocument();
    expect(within(form).getByText('יש להזין שנה')).toBeInTheDocument();
    expect(createPart).not.toHaveBeenCalled();
  });

  it('pre-selects the checkbox when editing an existing universal part', async () => {
    vi.mocked(getInventory).mockResolvedValue(envelope([UNIVERSAL_PART]));
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '✏️ ערוך' }));
    const form = screen.getByRole('form', { name: 'עריכת חלף' });

    expect(within(form).getByRole('checkbox', { name: 'מתאים לכל הרכבים' })).toBeChecked();
    // The make/model/year fields are hidden for a universal part.
    expect(within(form).queryByLabelText('יצרן')).not.toBeInTheDocument();
  });

  it('leaves the checkbox unchecked when editing a regular part', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getAllByRole('button', { name: '✏️ ערוך' })[0]);
    const form = screen.getByRole('form', { name: 'עריכת חלף' });

    expect(within(form).getByRole('checkbox', { name: 'מתאים לכל הרכבים' })).not.toBeChecked();
    expect(within(form).getByLabelText('יצרן')).toHaveValue('Volkswagen');
  });

  it('shows "כל הרכבים" in the inventory table for a universal part', async () => {
    vi.mocked(getInventory).mockResolvedValue(envelope([PARTS[0], UNIVERSAL_PART]));
    renderPage();
    await screen.findByRole('table');

    const row = (await screen.findByText('נורת חזית אוניברסלית')).closest('tr') as HTMLElement;
    expect(within(row).getByText('כל הרכבים')).toBeInTheDocument();
  });
});

describe('PartsPage — edit part', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInventory).mockResolvedValue(envelope(PARTS));
  });

  async function openEditFirstPart() {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getAllByRole('button', { name: '✏️ ערוך' })[0]);
    return screen.getByRole('form', { name: 'עריכת חלף' });
  }

  it('prefills the edit form and validates a cleared field', async () => {
    const form = await openEditFirstPart();
    expect(within(form).getByLabelText('שם חלף')).toHaveValue('בלמים דיסק קדמי');
    expect(within(form).getByLabelText('מק"ט')).toHaveValue('BRK001');

    await userEvent.clear(within(form).getByLabelText('שם חלף'));
    await userEvent.click(within(form).getByRole('button', { name: 'שמור שינויים' }));
    expect(await within(form).findByText('יש להזין שם חלף')).toBeInTheDocument();
    expect(updatePart).not.toHaveBeenCalled();
  });

  it('updates a part successfully', async () => {
    vi.mocked(updatePart).mockResolvedValue({ ...PARTS[0], quantity_current: 9 });
    const form = await openEditFirstPart();

    await userEvent.clear(within(form).getByLabelText('כמות במלאי'));
    await userEvent.type(within(form).getByLabelText('כמות במלאי'), '9');
    await userEvent.click(within(form).getByRole('button', { name: 'שמור שינויים' }));

    expect(updatePart).toHaveBeenCalledWith(1, {
      part_name: 'בלמים דיסק קדמי',
      part_code: 'BRK001',
      manufacturer: 'Volkswagen',
      model: 'Golf',
      year_start: 2015,
      quantity_current: 9,
    });
    expect(await screen.findByText('✓ החלף עודכן בהצלחה.')).toBeInTheDocument();
  });

  it('shows a known backend error in Hebrew', async () => {
    vi.mocked(updatePart).mockRejectedValueOnce(axiosError('Part not found.'));
    const form = await openEditFirstPart();
    await userEvent.click(within(form).getByRole('button', { name: 'שמור שינויים' }));
    expect(await within(form).findByText('החלף לא נמצא במערכת.')).toBeInTheDocument();
  });

  it('maps a duplicate part_code error on update to Hebrew', async () => {
    vi.mocked(updatePart).mockRejectedValueOnce(axiosError('part_code already exists.'));
    const form = await openEditFirstPart();
    await userEvent.clear(within(form).getByLabelText('מק"ט'));
    await userEvent.type(within(form).getByLabelText('מק"ט'), 'OIL002');
    await userEvent.click(within(form).getByRole('button', { name: 'שמור שינויים' }));
    expect(await within(form).findByText('מק״ט כבר קיים במערכת.')).toBeInTheDocument();
  });
});

describe('PartsPage — quantity update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInventory).mockResolvedValue(envelope(PARTS));
  });

  it('updates a part quantity successfully', async () => {
    vi.mocked(updatePartQuantity).mockResolvedValue({ ...PARTS[0], quantity_current: 8 });
    renderPage();
    await screen.findByRole('table');

    await userEvent.click(screen.getAllByRole('button', { name: '🔢 עדכן כמות' })[0]);
    const form = screen.getByRole('form', { name: /עדכון כמות/ });

    const input = within(form).getByLabelText('כמות במלאי');
    await userEvent.clear(input);
    await userEvent.type(input, '8');
    await userEvent.click(within(form).getByRole('button', { name: 'שמור כמות' }));

    expect(updatePartQuantity).toHaveBeenCalledWith(1, 8);
    expect(await screen.findByText('✓ הכמות עודכנה בהצלחה.')).toBeInTheDocument();
  });

  it('blocks an invalid quantity with an inline Hebrew message', async () => {
    renderPage();
    await screen.findByRole('table');

    await userEvent.click(screen.getAllByRole('button', { name: '🔢 עדכן כמות' })[0]);
    const form = screen.getByRole('form', { name: /עדכון כמות/ });

    const input = within(form).getByLabelText('כמות במלאי');
    await userEvent.clear(input);
    await userEvent.type(input, '-1');
    await userEvent.click(within(form).getByRole('button', { name: 'שמור כמות' }));

    expect(await within(form).findByText('הכמות חייבת להיות מספר שלם אי-שלילי')).toBeInTheDocument();
    expect(updatePartQuantity).not.toHaveBeenCalled();
  });
});

describe('PartsPage — role access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInventory).mockResolvedValue(envelope(PARTS));
    sessionStorage.clear();
  });

  it('a Manager can access the page and sees management actions', async () => {
    renderPage(MANAGER);
    expect(await screen.findByRole('heading', { name: 'מלאי חלקים' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '➕ חלף חדש' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '✏️ ערוך' }).length).toBeGreaterThan(0);
  });

  it('a Secretary can access the page and sees management actions', async () => {
    renderPage(SECRETARY);
    expect(await screen.findByRole('heading', { name: 'מלאי חלקים' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '➕ חלף חדש' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '🔢 עדכן כמות' }).length).toBeGreaterThan(0);
  });

  it('a Mechanic is redirected away from the inventory page', async () => {
    mockUser = MECHANIC;
    sessionStorage.setItem('access_token', 'test-token');
    sessionStorage.setItem('current_user', JSON.stringify(MECHANIC));
    window.history.pushState({}, '', '/parts');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'מלאי חלקים' })).not.toBeInTheDocument();
  });
});
