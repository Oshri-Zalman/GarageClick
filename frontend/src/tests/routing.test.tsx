import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';
import KanbanPage from '../pages/KanbanPage';
import NewTicketPage from '../pages/NewTicketPage';
import CustomersPage from '../pages/CustomersPage';
import PartsPage from '../pages/PartsPage';
import ReportsPage from '../pages/ReportsPage';
import UsersPage from '../pages/UsersPage';
import NotFoundPage from '../pages/NotFoundPage';
import LoginPage from '../pages/LoginPage';

vi.mock('../services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: () => false,
  // KanbanPage reads the current user via useAuth → getStoredUser. With no user
  // the board is not rendered, so this placeholder route test only sees the
  // page heading.
  getStoredUser: () => null,
}));

function renderAt(path: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Route placeholders render', () => {
  it('/login renders LoginPage', () => {
    renderAt('/login', <LoginPage />);
    expect(screen.getByText(/GarageClick/)).toBeInTheDocument();
  });

  it('/dashboard renders DashboardPage in Hebrew', () => {
    renderAt('/dashboard', <DashboardPage />);
    expect(screen.getByRole('heading', { name: 'לוח בקרה' })).toBeInTheDocument();
  });

  it('/kanban renders KanbanPage in Hebrew', () => {
    renderAt('/kanban', <KanbanPage />);
    expect(screen.getByRole('heading', { name: 'כרטיסי עבודה' })).toBeInTheDocument();
  });

  it('/tickets/new renders NewTicketPage in Hebrew', () => {
    renderAt('/tickets/new', <NewTicketPage />);
    expect(screen.getByRole('heading', { name: 'קריאה חדשה' })).toBeInTheDocument();
  });

  it('/customers renders CustomersPage in Hebrew', () => {
    renderAt('/customers', <CustomersPage />);
    expect(screen.getByRole('heading', { name: 'לקוחות ורכבים' })).toBeInTheDocument();
  });

  it('/parts renders PartsPage in Hebrew', () => {
    renderAt('/parts', <PartsPage />);
    expect(screen.getByRole('heading', { name: 'מלאי חלקים' })).toBeInTheDocument();
  });

  it('/reports renders ReportsPage in Hebrew', () => {
    renderAt('/reports', <ReportsPage />);
    expect(screen.getByRole('heading', { name: 'דוחות מנהל' })).toBeInTheDocument();
  });

  it('/users renders UsersPage in Hebrew', () => {
    renderAt('/users', <UsersPage />);
    expect(screen.getByRole('heading', { name: 'ניהול משתמשים' })).toBeInTheDocument();
  });

  it('unknown path renders NotFoundPage in Hebrew', () => {
    renderAt('/unknown', <NotFoundPage />);
    expect(screen.getByRole('heading', { name: 'הדף לא נמצא' })).toBeInTheDocument();
  });
});
