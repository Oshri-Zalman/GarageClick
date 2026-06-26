import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import Header from '../layouts/Header';

// The change-password dialog calls the auth service; mock it and keep the rest of
// the auth module (e.g. logout) as no-ops so the Header renders standalone.
vi.mock('../services/auth', () => ({
  logout: vi.fn(),
  changePassword: vi.fn(),
}));

import { changePassword } from '../services/auth';

// Builds an AxiosError carrying a backend `detail`, like the real api client.
function axiosError(detail: string, status = 400): AxiosError {
  const err = new AxiosError('request failed');
  err.response = { data: { detail }, status } as AxiosError['response'];
  return err;
}

function renderHeader(role = 'Manager') {
  return render(
    <MemoryRouter>
      <Header userName="אורי" userRole={role} />
    </MemoryRouter>
  );
}

async function openDialog(role = 'Manager') {
  renderHeader(role);
  await userEvent.click(screen.getByRole('button', { name: 'החלפת סיסמה' }));
  return screen.getByRole('dialog', { name: 'החלפת סיסמה' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Change password — entry point', () => {
  it.each(['Manager', 'Secretary', 'Mechanic'])(
    'renders the "החלפת סיסמה" entry point for %s',
    (role) => {
      renderHeader(role);
      expect(screen.getByRole('button', { name: 'החלפת סיסמה' })).toBeInTheDocument();
    }
  );

  it('does not render the entry point when no user is signed in', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.queryByRole('button', { name: 'החלפת סיסמה' })).not.toBeInTheDocument();
  });

  it('opens the modal when the entry point is clicked', async () => {
    const dialog = await openDialog();
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText('סיסמה נוכחית')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('סיסמה חדשה')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('אימות סיסמה חדשה')).toBeInTheDocument();
  });
});

describe('Change password — validation', () => {
  it('blocks submit and shows required-field messages when empty', async () => {
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(await within(dialog).findByText('יש להזין את הסיסמה הנוכחית')).toBeInTheDocument();
    expect(within(dialog).getByText('יש להזין סיסמה חדשה')).toBeInTheDocument();
    expect(within(dialog).getByText('יש לאמת את הסיסמה החדשה')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('enforces the new-password minimum length', async () => {
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'oldpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), '123');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), '123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(await within(dialog).findByText('הסיסמה חייבת להכיל לפחות 6 תווים')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('blocks a confirm-password mismatch', async () => {
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'oldpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), 'newpass1');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), 'newpass2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(await within(dialog).findByText('הסיסמאות אינן תואמות')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });
});

describe('Change password — submit', () => {
  it('calls the API with the correct payload and shows a success message', async () => {
    vi.mocked(changePassword).mockResolvedValue();
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'oldpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), 'newpass1');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), 'newpass1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(changePassword).toHaveBeenCalledWith('oldpass', 'newpass1');
    expect(await screen.findByText('הסיסמה עודכנה בהצלחה.')).toBeInTheDocument();
  });

  it('maps an incorrect current password to a Hebrew message', async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(
      axiosError('Current password is incorrect.', 400)
    );
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'wrongpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), 'newpass1');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), 'newpass1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(await within(dialog).findByText('הסיסמה הנוכחית אינה נכונה.')).toBeInTheDocument();
  });

  it('maps a 401 to a re-login prompt', async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(axiosError('Not authenticated', 401));
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'oldpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), 'newpass1');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), 'newpass1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(
      await within(dialog).findByText('יש להתחבר מחדש כדי לבצע פעולה זו.')
    ).toBeInTheDocument();
  });

  it('falls back to a safe generic Hebrew message on an unknown error', async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(new Error('boom'));
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'oldpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), 'newpass1');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), 'newpass1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(
      await within(dialog).findByText('אירעה שגיאה בעת עדכון הסיסמה. נסה שוב.')
    ).toBeInTheDocument();
  });
});
