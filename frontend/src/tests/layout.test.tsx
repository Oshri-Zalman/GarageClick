import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../layouts/Sidebar';
import Header from '../layouts/Header';

vi.mock('../services/auth', () => ({
  logout: vi.fn(),
}));

describe('Sidebar Hebrew navigation', () => {
  it('renders all core nav items in Hebrew', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('לוח בקרה')).toBeInTheDocument();
    expect(screen.getByText('לוח קנבן')).toBeInTheDocument();
    expect(screen.getByText('קריאה חדשה')).toBeInTheDocument();
    expect(screen.getByText('לקוחות ורכבים')).toBeInTheDocument();
    expect(screen.getByText('מלאי חלקים')).toBeInTheDocument();
  });

  it('hides Manager-only items for non-manager roles', () => {
    render(
      <MemoryRouter>
        <Sidebar userRole="Mechanic" />
      </MemoryRouter>
    );
    expect(screen.queryByText('דוחות')).not.toBeInTheDocument();
    expect(screen.queryByText('ניהול משתמשים')).not.toBeInTheDocument();
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
