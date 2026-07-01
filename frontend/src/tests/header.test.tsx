import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Header from '../layouts/Header';

// Logout + change password are reached from the header user menu; mock the auth
// service so logout is observable and the dialog import resolves.
vi.mock('../services/auth', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn(),
}));

import { logout } from '../services/auth';

function renderHeader(role = 'Manager') {
  return render(
    <MemoryRouter>
      <Header userName="אורי" userRole={role} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Header — user menu', () => {
  it('does not render standalone "החלפת סיסמה" or "יציאה" buttons by default', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: 'החלפת סיסמה' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'יציאה' })).not.toBeInTheDocument();
    // The dropdown is closed until the trigger is clicked.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens a dropdown with both actions when the user menu is clicked', async () => {
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'תפריט משתמש' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'החלפת סיסמה' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'יציאה' })).toBeInTheDocument();
  });

  it('has no duplicate logout control', async () => {
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    // Exactly one logout control, and it is the menu item (not a header button).
    expect(screen.getAllByRole('menuitem', { name: 'יציאה' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'יציאה' })).not.toBeInTheDocument();
  });

  it('opens the change-password dialog from the menu', async () => {
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'החלפת סיסמה' }));

    expect(screen.getByRole('dialog', { name: 'החלפת סיסמה' })).toBeInTheDocument();
  });

  it('logs out when "יציאה" is clicked', async () => {
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'יציאה' }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it.each(['Manager', 'Secretary', 'Mechanic'])(
    'exposes the menu actions for %s',
    async (role) => {
      renderHeader(role);
      await userEvent.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
      expect(screen.getByRole('menuitem', { name: 'החלפת סיסמה' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'יציאה' })).toBeInTheDocument();
    }
  );

  it('shows no user menu when logged out', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.queryByRole('button', { name: 'תפריט משתמש' })).not.toBeInTheDocument();
  });
});
