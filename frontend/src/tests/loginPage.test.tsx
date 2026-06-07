import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import type { AuthToken } from '../types';

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

  it('shows a Hebrew error message when login fails', async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error('401'));
    renderLogin();

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'uri');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'כניסה' }));

    expect(await screen.findByText('שם משתמש או סיסמה שגויים')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
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
