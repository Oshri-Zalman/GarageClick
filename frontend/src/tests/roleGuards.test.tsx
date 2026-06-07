import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';
import type { Role } from '../types';

// The Kanban board fetches tickets on mount; stub the service so these auth/route
// integration tests never hit the network and only assert on navigation.
vi.mock('../services/tickets', () => ({
  listTickets: vi.fn().mockResolvedValue([]),
  updateTicketStatus: vi.fn(),
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

    expect(await screen.findByRole('heading', { name: 'דוחות מנהל' })).toBeInTheDocument();
    // Manager-only sidebar entries (labels differ from page headings).
    expect(screen.getByText('דוחות')).toBeInTheDocument();
    expect(screen.getByText('ניהול משתמשים')).toBeInTheDocument();
    expect(screen.getByText('ניטור עובדים')).toBeInTheDocument();
  });

  it('can open user management', async () => {
    loginAs('Manager');
    goTo('/users');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'ניהול משתמשים' })).toBeInTheDocument();
  });

  it('can open My Tickets (own/assigned tickets)', async () => {
    loginAs('Manager');
    goTo('/my-tickets');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'הכרטיסים שלי' })).toBeInTheDocument();
  });
});

describe('Secretary access', () => {
  it('reaches operational pages and sees parts but not manager tools', async () => {
    loginAs('Secretary');
    goTo('/dashboard');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'לוח בקרה' })).toBeInTheDocument();
    expect(screen.getByText('מלאי חלקים')).toBeInTheDocument();
    expect(screen.queryByText('דוחות')).not.toBeInTheDocument();
    expect(screen.queryByText('ניהול משתמשים')).not.toBeInTheDocument();
    expect(screen.queryByText('ניטור עובדים')).not.toBeInTheDocument();
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
    expect(screen.getByText('הכרטיסים שלי')).toBeInTheDocument();
    // Mechanics can always open a new ticket (on themselves).
    expect(screen.getByText('קריאה חדשה')).toBeInTheDocument();
    expect(screen.queryByText('מלאי חלקים')).not.toBeInTheDocument();
    expect(screen.queryByText('דוחות')).not.toBeInTheDocument();
    expect(screen.queryByText('ניהול משתמשים')).not.toBeInTheDocument();
    expect(screen.queryByText('לוח בקרה')).not.toBeInTheDocument();
    expect(screen.queryByText('לקוחות ורכבים')).not.toBeInTheDocument();
  });

  it('can open the My Tickets page', async () => {
    loginAs('Mechanic');
    goTo('/my-tickets');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'הכרטיסים שלי' })).toBeInTheDocument();
  });

  it('can open the New Ticket page', async () => {
    loginAs('Mechanic');
    goTo('/tickets/new');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'קריאה חדשה' })).toBeInTheDocument();
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
