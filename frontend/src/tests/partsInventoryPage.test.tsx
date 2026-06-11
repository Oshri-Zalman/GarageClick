import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import PartsPage from '../pages/PartsPage';
import App from '../App';
import type { Part, User } from '../types';

vi.mock('../services/parts', () => ({
  getAllParts: vi.fn(),
  createPart: vi.fn(),
  updatePart: vi.fn(),
  updatePartQuantity: vi.fn(),
}));

// The Kanban board (the page a blocked mechanic is redirected to) fetches tickets
// on mount; stub the service so the role-access integration test never hits the
// network.
vi.mock('../services/tickets', () => ({
  listTickets: vi.fn().mockResolvedValue([]),
  updateTicketStatus: vi.fn(),
}));

import { getAllParts, createPart, updatePart, updatePartQuantity } from '../services/parts';

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

function renderPage(user: User = MANAGER) {
  mockUser = user;
  return render(<PartsPage />);
}

describe('PartsPage — inventory list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the inventory table with the loaded parts', async () => {
    vi.mocked(getAllParts).mockResolvedValue(PARTS);
    renderPage();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('בלמים דיסק קדמי')).toBeInTheDocument();
    expect(screen.getByText('מסנן שמן')).toBeInTheDocument();
    expect(screen.getByText('BRK001')).toBeInTheDocument();
  });

  it('shows a Hebrew loading state while the inventory loads', () => {
    vi.mocked(getAllParts).mockReturnValue(new Promise<Part[]>(() => {}));
    renderPage();
    expect(screen.getByText('טוען מלאי חלקים...')).toBeInTheDocument();
  });

  it('shows an empty state when there are no parts at all', async () => {
    vi.mocked(getAllParts).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('אין חלפים במלאי. הוסף חלף חדש כדי להתחיל.')).toBeInTheDocument();
  });

  it('shows a Hebrew error state with retry when loading fails', async () => {
    vi.mocked(getAllParts).mockRejectedValueOnce(new Error('500'));
    renderPage();

    expect(await screen.findByText('שגיאה בטעינת המלאי. נסה שוב.')).toBeInTheDocument();

    vi.mocked(getAllParts).mockResolvedValueOnce(PARTS);
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('renders an out-of-stock status when quantity_current is 0', async () => {
    vi.mocked(getAllParts).mockResolvedValue(PARTS);
    renderPage();

    const row = (await screen.findByText('מסנן שמן')).closest('tr') as HTMLElement;
    expect(within(row).getByText('אזל מהמלאי')).toBeInTheDocument();
  });

  it('renders an available status when quantity_current is greater than 0', async () => {
    vi.mocked(getAllParts).mockResolvedValue(PARTS);
    renderPage();

    const row = (await screen.findByText('בלמים דיסק קדמי')).closest('tr') as HTMLElement;
    expect(within(row).getByText('זמין')).toBeInTheDocument();
  });
});

describe('PartsPage — search / filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllParts).mockResolvedValue(PARTS);
  });

  it('filters by manufacturer', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('יצרן'), 'BMW');

    expect(screen.getByText('מסנן שמן')).toBeInTheDocument();
    expect(screen.queryByText('בלמים דיסק קדמי')).not.toBeInTheDocument();
  });

  it('filters by model', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('דגם'), 'Golf');

    expect(screen.getByText('בלמים דיסק קדמי')).toBeInTheDocument();
    expect(screen.queryByText('מסנן שמן')).not.toBeInTheDocument();
  });

  it('filters by part name', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('שם חלף'), 'מסנן');

    expect(screen.getByText('מסנן שמן')).toBeInTheDocument();
    expect(screen.queryByText('בלמים דיסק קדמי')).not.toBeInTheDocument();
  });

  it('filters by part code', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('מק"ט'), 'BRK');

    expect(screen.getByText('בלמים דיסק קדמי')).toBeInTheDocument();
    expect(screen.queryByText('מסנן שמן')).not.toBeInTheDocument();
  });

  it('shows a no-match state when the filter excludes every part', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('שם חלף'), 'לא קיים');
    expect(screen.getByText('לא נמצאו חלפים התואמים לסינון.')).toBeInTheDocument();
  });
});

describe('PartsPage — create part', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllParts).mockResolvedValue(PARTS);
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
});

describe('PartsPage — edit part', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllParts).mockResolvedValue(PARTS);
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
});

describe('PartsPage — quantity update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllParts).mockResolvedValue(PARTS);
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
    vi.mocked(getAllParts).mockResolvedValue(PARTS);
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
