import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Sidebar from '../layouts/Sidebar';
import Header from '../layouts/Header';
import AppLayout from '../layouts/AppLayout';
import type { User } from '../types';

vi.mock('../services/auth', () => ({
  logout: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn().mockReturnValue({ user: null, loading: false, error: null }),
}));

import { useAuth } from '../hooks/useAuth';

describe('Sidebar Hebrew navigation', () => {
  it('renders core nav items visible to all roles in Hebrew', () => {
    render(
      <MemoryRouter>
        <Sidebar userRole="Secretary" />
      </MemoryRouter>
    );
    expect(screen.getByText('לוח בקרה')).toBeInTheDocument();
    expect(screen.getByText('לוח עבודה')).toBeInTheDocument();
    expect(screen.getByText('לקוחות ורכבים')).toBeInTheDocument();
    expect(screen.getByText('מלאי חלקים')).toBeInTheDocument();
    // New Ticket moved to a Work Board modal — no longer a sidebar item.
    expect(screen.queryByText('קריאה חדשה')).not.toBeInTheDocument();
  });

  it('hides Manager-only and inventory items from Mechanic', () => {
    render(
      <MemoryRouter>
        <Sidebar userRole="Mechanic" />
      </MemoryRouter>
    );
    expect(screen.queryByText('דוחות')).not.toBeInTheDocument();
    expect(screen.queryByText('ניהול משתמשים')).not.toBeInTheDocument();
    expect(screen.queryByText('מלאי חלקים')).not.toBeInTheDocument();
  });

  it('shows Manager-only items for Manager role', () => {
    render(
      <MemoryRouter>
        <Sidebar userRole="Manager" />
      </MemoryRouter>
    );
    expect(screen.getByText('דוחות')).toBeInTheDocument();
    expect(screen.getByText('ניהול משתמשים')).toBeInTheDocument();
  });
});

describe('Header', () => {
  it('renders the app brand name', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText(/GarageClick/)).toBeInTheDocument();
  });

  it('shows the user name and Hebrew role badge', () => {
    render(
      <MemoryRouter>
        <Header userName="אורי" userRole="Manager" />
      </MemoryRouter>
    );
    expect(screen.getByText('אורי')).toBeInTheDocument();
    expect(screen.getByText('מנהל')).toBeInTheDocument();
  });

  it('shows logout button when user is logged in', () => {
    render(
      <MemoryRouter>
        <Header userName="אורי" userRole="Secretary" />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'יציאה' })).toBeInTheDocument();
  });
});

describe('AppLayout auth guard', () => {
  it('redirects to /login when no authenticated user', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, error: null });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/login" element={<div>כניסה</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('כניסה')).toBeInTheDocument();
  });

  it('renders the app shell when user is authenticated', () => {
    const mockUser: User = { id: 1, username: 'uri', full_name: 'Uri Cohen', email: null, role: 'Manager', is_active: true };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, loading: false, error: null });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="dashboard" element={<div>תוכן לוח בקרה</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('תוכן לוח בקרה')).toBeInTheDocument();
  });
});
