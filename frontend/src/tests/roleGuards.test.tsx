import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';
import type { Role } from '../types';

// The Kanban board fetches tickets on mount; stub the service so these auth/route
// integration tests never hit the network and only assert on navigation.
vi.mock('../services/tickets', () => ({
  listTickets: vi.fn().mockResolvedValue([]),
  updateTicketStatus: vi.fn(),
  archiveTicket: vi.fn(),
}));

// The Secretary dashboard reads the staff summary on mount; stub it so these
// route-integration tests stay offline.
vi.mock('../services/staff', () => ({
  getStaffTicketsSummary: vi.fn().mockResolvedValue({
    total_pending: 0,
    total_in_progress: 0,
    total_completed: 0,
    avg_completion_minutes: null,
  }),
}));

// The User Management page fetches the user list on mount; stub it so the
// Manager-access route test stays offline (Stage 9).
vi.mock('../services/users', () => ({
  listUsers: vi.fn().mockResolvedValue([]),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

// These are full-app integration tests: they exercise the real auth service
// (backed by sessionStorage), the route guards, and the sidebar together.

function loginAs(role: Role) {
  sessionStorage.setItem('access_token', 'test-token');
  sessionStorage.setItem(
    'current_user',
    JSON.stringify({ id: 1, username: 'u', full_name: 'משתמש', email: null, role, is_active: true })
  );
}

function goTo(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('authentication guard', () => {
  it('redirects unauthenticated users to the login page', async () => {
    goTo('/dashboard');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'כניסה' })).toBeInTheDocument();
  });
});

describe('Manager access', () => {
  it('reaches the manager-only pages and sees the manager nav items', async () => {
    loginAs('Manager');
    goTo('/reports');
    render(<App />);

    // The /reports route is still reachable directly (kept for backward
    // compatibility), so the page heading still renders…
    expect(await screen.findByRole('heading', { name: 'דוחות מנהל' })).toBeInTheDocument();
    // …but "דוחות" is no longer a sidebar item — reports are redundant with the
    // report-like sections inside the Manager Dashboard.
    expect(screen.queryByText('דוחות')).not.toBeInTheDocument();
    // Manager-only sidebar entries (labels differ from page headings).
    expect(screen.getByText('ניהול משתמשים')).toBeInTheDocument();
    // "ניטור עובדים" is no longer a sidebar item — employee monitoring lives
    // inside the Manager Dashboard (/dashboard) (Stage 10 navigation cleanup).
    expect(screen.queryByText('ניטור עובדים')).not.toBeInTheDocument();
  });

  it('can open user management', async () => {
    loginAs('Manager');
    goTo('/users');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'ניהול משתמשים' })).toBeInTheDocument();
  });

  it('can open the ticket archive', async () => {
    loginAs('Manager');
    goTo('/my-tickets');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'ארכיון כרטיסים' })).toBeInTheDocument();
  });
});

describe('Secretary access', () => {
  it('reaches operational pages and sees parts but not manager tools', async () => {
    loginAs('Secretary');
    goTo('/dashboard');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'לוח בקרה' })).toBeInTheDocument();
    expect(screen.getByText('מלאי חלקים')).toBeInTheDocument();
    // The ticket archive is available to Secretary as well.
    expect(screen.getByText('ארכיון כרטיסים')).toBeInTheDocument();
    expect(screen.queryByText('דוחות')).not.toBeInTheDocument();
    expect(screen.queryByText('ניהול משתמשים')).not.toBeInTheDocument();
    expect(screen.queryByText('ניטור עובדים')).not.toBeInTheDocument();
  });

  it('can open the ticket archive (garage archive)', async () => {
    loginAs('Secretary');
    goTo('/my-tickets');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'ארכיון כרטיסים' })).toBeInTheDocument();
  });

  it('is redirected away from Reports back to its home page', async () => {
    loginAs('Secretary');
    goTo('/reports');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'לוח בקרה' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'דוחות מנהל' })).not.toBeInTheDocument();
  });

  it('is redirected away from User Management back to its home page', async () => {
    loginAs('Secretary');
    goTo('/users');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'לוח בקרה' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ניהול משתמשים' })).not.toBeInTheDocument();
  });
});

describe('Mechanic access', () => {
  it('lands on Kanban with My Tickets and New Ticket, and no restricted nav items', async () => {
    loginAs('Mechanic');
    goTo('/kanban');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
    expect(screen.getByText('ארכיון כרטיסים')).toBeInTheDocument();
    // New Ticket is now opened from a Work Board modal, not a sidebar item.
    expect(screen.queryByText('קריאה חדשה')).not.toBeInTheDocument();
    expect(screen.queryByText('מלאי חלקים')).not.toBeInTheDocument();
    expect(screen.queryByText('דוחות')).not.toBeInTheDocument();
    expect(screen.queryByText('ניהול משתמשים')).not.toBeInTheDocument();
    expect(screen.queryByText('לוח בקרה')).not.toBeInTheDocument();
    expect(screen.queryByText('לקוחות ורכבים')).not.toBeInTheDocument();
  });

  it('can open the ticket archive page', async () => {
    loginAs('Mechanic');
    goTo('/my-tickets');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'ארכיון כרטיסים' })).toBeInTheDocument();
  });

  it('can open the New Ticket page', async () => {
    loginAs('Mechanic');
    goTo('/tickets/new');
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'פתיחת כרטיס עבודה חדש' })
    ).toBeInTheDocument();
  });

  it('is redirected away from Parts Inventory to Kanban', async () => {
    loginAs('Mechanic');
    goTo('/parts');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'מלאי חלקים' })).not.toBeInTheDocument();
  });

  it('is redirected away from Reports to Kanban', async () => {
    loginAs('Mechanic');
    goTo('/reports');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'דוחות מנהל' })).not.toBeInTheDocument();
  });

  it('is redirected away from User Management to Kanban', async () => {
    loginAs('Mechanic');
    goTo('/users');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ניהול משתמשים' })).not.toBeInTheDocument();
  });
});
