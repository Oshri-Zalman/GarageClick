import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import UsersPage from '../pages/UsersPage';
import type { ManagedUser, User } from '../types';

vi.mock('../services/users', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

import { listUsers, createUser, updateUser, deleteUser } from '../services/users';

// useAuth reads the current user; swap it per test via this mutable ref.
let mockUser: User;
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, loading: false, error: null }),
}));

const MANAGER: User = {
  id: 1,
  username: 'boss',
  full_name: 'מירה מנהלת',
  email: null,
  role: 'Manager',
  is_active: true,
};

// The list returned by GET /api/admin/users. Includes the signed-in manager
// (id 1) so the "cannot delete self" path is reachable.
const USERS: ManagedUser[] = [
  {
    id: 1,
    username: 'boss',
    full_name: 'מירה מנהלת',
    email: null,
    role: 'Manager',
    is_active: true,
    created_at: '2026-01-01T08:00:00Z',
  },
  {
    id: 2,
    username: 'sara',
    full_name: 'שרה מזכירה',
    email: null,
    role: 'Secretary',
    is_active: true,
    created_at: '2026-01-02T08:00:00Z',
  },
  {
    id: 3,
    username: 'moshe',
    full_name: 'משה מכונאי',
    email: null,
    role: 'Mechanic',
    is_active: false,
    created_at: '2026-01-03T08:00:00Z',
  },
];

// Builds an AxiosError carrying a backend `detail`, like the real api client.
function axiosError(detail: string, status = 400): AxiosError {
  const err = new AxiosError('request failed');
  err.response = { data: { detail }, status } as AxiosError['response'];
  return err;
}

function rowFor(name: string): HTMLElement {
  const cell = screen.getByText(name);
  const row = cell.closest('tr');
  if (!row) throw new Error(`row for ${name} not found`);
  return row as HTMLElement;
}

function renderPage(user: User = MANAGER) {
  mockUser = user;
  return render(<UsersPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listUsers).mockResolvedValue(USERS);
});

describe('UsersPage — listing', () => {
  it('shows a loading state then renders the users table from the API', async () => {
    let resolve!: (rows: ManagedUser[]) => void;
    vi.mocked(listUsers).mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();

    expect(screen.getByText('טוען משתמשים...')).toBeInTheDocument();

    resolve(USERS);
    expect(await screen.findByRole('table', { name: 'טבלת משתמשים' })).toBeInTheDocument();
    expect(screen.getByText('שרה מזכירה')).toBeInTheDocument();
    expect(screen.getByText('משה מכונאי')).toBeInTheDocument();
    // Inactive user is flagged.
    expect(within(rowFor('משה מכונאי')).getByText('מושבת')).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when there are no users', async () => {
    vi.mocked(listUsers).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('לא נמצאו משתמשים במערכת.')).toBeInTheDocument();
  });

  it('shows a Hebrew error state with retry that refetches', async () => {
    vi.mocked(listUsers).mockRejectedValueOnce(new Error('500'));
    renderPage();

    expect(await screen.findByText('שגיאה בטעינת המשתמשים. נסה שוב.')).toBeInTheDocument();

    vi.mocked(listUsers).mockResolvedValueOnce(USERS);
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByText('שרה מזכירה')).toBeInTheDocument();
  });
});

describe('UsersPage — create user', () => {
  it('renders the create form and validates before submit', async () => {
    renderPage();
    await screen.findByRole('table', { name: 'טבלת משתמשים' });

    await userEvent.click(screen.getByRole('button', { name: '➕ משתמש חדש' }));
    const form = screen.getByRole('form', { name: 'משתמש חדש' });
    await userEvent.click(within(form).getByRole('button', { name: 'צור משתמש' }));

    expect(await within(form).findByText('יש להזין שם משתמש')).toBeInTheDocument();
    expect(within(form).getByText('יש להזין סיסמה זמנית')).toBeInTheDocument();
    expect(within(form).getByText('יש להזין שם מלא')).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it('enforces the backend minimum lengths for username and password', async () => {
    renderPage();
    await screen.findByRole('table', { name: 'טבלת משתמשים' });

    await userEvent.click(screen.getByRole('button', { name: '➕ משתמש חדש' }));
    const form = screen.getByRole('form', { name: 'משתמש חדש' });
    await userEvent.type(within(form).getByLabelText('שם משתמש'), 'ab');
    await userEvent.type(within(form).getByLabelText('סיסמה זמנית'), '123');
    await userEvent.type(within(form).getByLabelText('שם מלא'), 'בודק');
    await userEvent.click(within(form).getByRole('button', { name: 'צור משתמש' }));

    expect(await within(form).findByText('שם המשתמש חייב להכיל לפחות 3 תווים')).toBeInTheDocument();
    expect(within(form).getByText('הסיסמה חייבת להכיל לפחות 6 תווים')).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it('creates a user and refetches the list', async () => {
    vi.mocked(createUser).mockResolvedValue(USERS[2]);
    renderPage();
    await screen.findByRole('table', { name: 'טבלת משתמשים' });

    await userEvent.click(screen.getByRole('button', { name: '➕ משתמש חדש' }));
    const form = screen.getByRole('form', { name: 'משתמש חדש' });
    await userEvent.type(within(form).getByLabelText('שם משתמש'), 'newmech');
    await userEvent.type(within(form).getByLabelText('סיסמה זמנית'), 'secret123');
    await userEvent.type(within(form).getByLabelText('שם מלא'), 'מכונאי חדש');
    await userEvent.selectOptions(within(form).getByLabelText('תפקיד'), 'Mechanic');
    await userEvent.click(within(form).getByRole('button', { name: 'צור משתמש' }));

    expect(createUser).toHaveBeenCalledWith({
      username: 'newmech',
      password: 'secret123',
      full_name: 'מכונאי חדש',
      role: 'Mechanic',
    });
    expect(await screen.findByText('✓ המשתמש נוצר בהצלחה.')).toBeInTheDocument();
    // Mounted load + post-create reload.
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('shows a duplicate-username backend error in Hebrew', async () => {
    vi.mocked(createUser).mockRejectedValueOnce(axiosError('username already exists.', 409));
    renderPage();
    await screen.findByRole('table', { name: 'טבלת משתמשים' });

    await userEvent.click(screen.getByRole('button', { name: '➕ משתמש חדש' }));
    const form = screen.getByRole('form', { name: 'משתמש חדש' });
    await userEvent.type(within(form).getByLabelText('שם משתמש'), 'sara');
    await userEvent.type(within(form).getByLabelText('סיסמה זמנית'), 'secret123');
    await userEvent.type(within(form).getByLabelText('שם מלא'), 'כפילה');
    await userEvent.click(within(form).getByRole('button', { name: 'צור משתמש' }));

    expect(await within(form).findByText('שם המשתמש כבר קיים במערכת.')).toBeInTheDocument();
  });
});

describe('UsersPage — edit user', () => {
  it('renders the edit form prefilled (username locked) and submits PATCH', async () => {
    vi.mocked(updateUser).mockResolvedValue({ ...USERS[1], full_name: 'שרה לוי' });
    renderPage();
    await screen.findByRole('table', { name: 'טבלת משתמשים' });

    await userEvent.click(within(rowFor('שרה מזכירה')).getByRole('button', { name: 'ערוך' }));
    const form = screen.getByRole('form', { name: 'עריכת משתמש' });
    expect(within(form).getByLabelText('שם משתמש')).toBeDisabled();
    expect(within(form).getByLabelText('שם משתמש')).toHaveValue('sara');

    await userEvent.clear(within(form).getByLabelText('שם מלא'));
    await userEvent.type(within(form).getByLabelText('שם מלא'), 'שרה לוי');
    await userEvent.click(within(form).getByRole('button', { name: 'שמור שינויים' }));

    expect(updateUser).toHaveBeenCalledWith(2, { full_name: 'שרה לוי', role: 'Secretary' });
    expect(await screen.findByText('✓ המשתמש עודכן בהצלחה.')).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledTimes(2);
  });
});

describe('UsersPage — activate/deactivate', () => {
  it('requires confirmation before calling the API and then refetches', async () => {
    vi.mocked(updateUser).mockResolvedValue({ ...USERS[1], is_active: false });
    renderPage();
    await screen.findByRole('table', { name: 'טבלת משתמשים' });

    await userEvent.click(within(rowFor('שרה מזכירה')).getByRole('button', { name: 'השבת' }));
    // No API call until the dialog is confirmed.
    expect(updateUser).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'השבת' }));

    expect(updateUser).toHaveBeenCalledWith(2, { is_active: false });
    expect(await screen.findByText('✓ המשתמש הושבת.')).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('activates an inactive user after confirmation', async () => {
    vi.mocked(updateUser).mockResolvedValue({ ...USERS[2], is_active: true });
    renderPage();
    await screen.findByRole('table', { name: 'טבלת משתמשים' });

    await userEvent.click(within(rowFor('משה מכונאי')).getByRole('button', { name: 'הפעל' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'הפעל' }));

    expect(updateUser).toHaveBeenCalledWith(3, { is_active: true });
    expect(await screen.findByText('✓ המשתמש הופעל.')).toBeInTheDocument();
  });
});

describe('UsersPage — delete user', () => {
  it('requires confirmation before deleting and then refetches', async () => {
    vi.mocked(deleteUser).mockResolvedValue();
    renderPage();
    await screen.findByRole('table', { name: 'טבלת משתמשים' });

    await userEvent.click(within(rowFor('שרה מזכירה')).getByRole('button', { name: 'מחק' }));
    expect(deleteUser).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'מחק' }));

    expect(deleteUser).toHaveBeenCalledWith(2);
    expect(await screen.findByText('✓ המשתמש נמחק.')).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('shows a "cannot delete self" backend error in Hebrew', async () => {
    vi.mocked(deleteUser).mockRejectedValueOnce(
      axiosError('You cannot delete your own account.', 400)
    );
    renderPage();
    await screen.findByRole('table', { name: 'טבלת משתמשים' });

    await userEvent.click(within(rowFor('מירה מנהלת')).getByRole('button', { name: 'מחק' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'מחק' }));

    expect(await screen.findByText('לא ניתן למחוק את המשתמש שלך.')).toBeInTheDocument();
  });
});

describe('UsersPage — reset temporary password', () => {
  it('validates and then resets the password via PATCH', async () => {
    vi.mocked(updateUser).mockResolvedValue(USERS[1]);
    renderPage();
    await screen.findByRole('table', { name: 'טבלת משתמשים' });

    await userEvent.click(within(rowFor('שרה מזכירה')).getByRole('button', { name: 'איפוס סיסמה' }));
    const dialog = screen.getByRole('dialog', { name: 'איפוס סיסמה זמנית' });

    // Empty submit is blocked.
    await userEvent.click(within(dialog).getByRole('button', { name: 'אפס סיסמה' }));
    expect(await within(dialog).findByText('יש להזין סיסמה זמנית חדשה')).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();

    // Too short is blocked.
    await userEvent.type(within(dialog).getByLabelText('סיסמה זמנית חדשה'), '123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'אפס סיסמה' }));
    expect(await within(dialog).findByText('הסיסמה חייבת להכיל לפחות 6 תווים')).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();

    // A valid password goes through.
    await userEvent.type(within(dialog).getByLabelText('סיסמה זמנית חדשה'), '456');
    await userEvent.click(within(dialog).getByRole('button', { name: 'אפס סיסמה' }));

    expect(updateUser).toHaveBeenCalledWith(2, { password: '123456' });
    expect(await screen.findByText('✓ הסיסמה הזמנית אופסה.')).toBeInTheDocument();
  });
});
