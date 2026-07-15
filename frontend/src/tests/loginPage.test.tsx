import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import LoginPage from '../pages/LoginPage';
import type { AuthToken } from '../types';

// Builds an AxiosError with a given HTTP status, matching what the auth service
// rejects with when the backend rejects a login (e.g. 401 for bad credentials).
function axiosStatusError(status: number): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = {
    status,
    statusText: '',
    data: { detail: 'Invalid credentials' },
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return err;
}

vi.mock('../services/auth', () => ({
  login: vi.fn(),
  isAuthenticated: vi.fn(() => false),
  getStoredUser: vi.fn(() => null),
}));

import { login, isAuthenticated, getStoredUser } from '../services/auth';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>תוכן לוח בקרה</div>} />
        <Route path="/kanban" element={<div>תוכן קנבן</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthenticated).mockReturnValue(false);
    vi.mocked(getStoredUser).mockReturnValue(null);
  });

  it('logs in successfully and redirects to the role home page', async () => {
    vi.mocked(login).mockResolvedValueOnce({
      token: 'jwt',
      user_id: 1,
      role: 'Manager',
      full_name: 'אורי',
    });
    renderLogin();

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'uri');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'כניסה' }));

    expect(login).toHaveBeenCalledWith('uri', 'secret');
    expect(await screen.findByText('תוכן לוח בקרה')).toBeInTheDocument();
  });

  it('sends a logged-in mechanic to the kanban board', async () => {
    vi.mocked(login).mockResolvedValueOnce({
      token: 'jwt',
      user_id: 5,
      role: 'Mechanic',
      full_name: 'דוד',
    });
    renderLogin();

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'david');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'כניסה' }));

    expect(await screen.findByText('תוכן קנבן')).toBeInTheDocument();
  });

  it('shows the Hebrew invalid-credentials message when login is rejected (401)', async () => {
    vi.mocked(login).mockRejectedValueOnce(axiosStatusError(401));
    renderLogin();

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'uri');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'כניסה' }));

    expect(await screen.findByText('שם משתמש או סיסמה לא נכונים')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not crash and keeps the login form visible after a failed login', async () => {
    vi.mocked(login).mockRejectedValueOnce(axiosStatusError(401));
    renderLogin();

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'uri');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'כניסה' }));

    await screen.findByText('שם משתמש או סיסמה לא נכונים');
    // The form is still mounted and interactive — no crash, no white screen.
    expect(screen.getByLabelText('שם משתמש')).toBeInTheDocument();
    expect(screen.getByLabelText('סיסמה')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'כניסה' })).toBeEnabled();
  });

  it('shows a safe Hebrew fallback for an unknown (non-credentials) login error', async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error('network down'));
    renderLogin();

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'uri');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'כניסה' }));

    expect(await screen.findByText('אירעה שגיאה בהתחברות. נסה שוב מאוחר יותר.')).toBeInTheDocument();
  });

  it('lets the user try again and succeed after a failed login', async () => {
    vi.mocked(login).mockRejectedValueOnce(axiosStatusError(401));
    renderLogin();

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'uri');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'כניסה' }));
    await screen.findByText('שם משתמש או סיסמה לא נכונים');

    // Retry with the correct password — a second attempt succeeds and redirects.
    vi.mocked(login).mockResolvedValueOnce({
      token: 'jwt',
      user_id: 1,
      role: 'Manager',
      full_name: 'אורי',
    });
    await userEvent.clear(screen.getByLabelText('סיסמה'));
    await userEvent.type(screen.getByLabelText('סיסמה'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'כניסה' }));

    expect(await screen.findByText('תוכן לוח בקרה')).toBeInTheDocument();
  });

  it('shows a loading state and disables the button while logging in', async () => {
    let resolveLogin: (v: AuthToken) => void = () => {};
    vi.mocked(login).mockReturnValueOnce(
      new Promise<AuthToken>((resolve) => {
        resolveLogin = resolve;
      })
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'uri');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'כניסה' }));

    const button = await screen.findByRole('button', { name: 'מתחבר...' });
    expect(button).toBeDisabled();

    resolveLogin({ token: 'jwt', user_id: 1, role: 'Manager', full_name: 'אורי' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'מתחבר...' })).not.toBeInTheDocument());
  });

  it('redirects away from /login when already authenticated', async () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(getStoredUser).mockReturnValue({
      id: 2,
      username: 'sara',
      full_name: 'שרה',
      email: null,
      role: 'Secretary',
      is_active: true,
    });
    renderLogin();

    expect(await screen.findByText('תוכן לוח בקרה')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'כניסה' })).not.toBeInTheDocument();
  });
});
