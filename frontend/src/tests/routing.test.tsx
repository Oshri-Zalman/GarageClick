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
  // Pages read the current user via useAuth → getStoredUser. KanbanPage still
  // renders its heading with no user; NewTicketPage requires one, so that test
  // overrides the return value below.
  getStoredUser: vi.fn(() => null),
}));

// PartsPage fetches the inventory on mount; stub the service so this synchronous
// render check never hits the network.
vi.mock('../services/parts', () => ({
  getInventory: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 200, total: 0 }),
  createPart: vi.fn(),
  updatePart: vi.fn(),
  updatePartQuantity: vi.fn(),
}));

// UsersPage fetches the user list on mount; stub the service so this synchronous
// render check never hits the network (Stage 9).
vi.mock('../services/users', () => ({
  listUsers: vi.fn().mockResolvedValue([]),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

// ReportsPage fetches the manager-only admin endpoints on mount (Stage 11);
// stub them so this render check stays offline.
vi.mock('../services/admin', () => ({
  getTicketsSummary: vi.fn().mockResolvedValue({
    total_pending: 0,
    total_in_progress: 0,
    total_completed: 0,
    avg_completion_minutes: null,
  }),
  getEmployees: vi.fn().mockResolvedValue([]),
  getTicketsByDay: vi.fn().mockResolvedValue([]),
  getPerformance: vi.fn(),
}));

import { getStoredUser } from '../services/auth';

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
    expect(screen.getByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
  });

  it('/tickets/new renders NewTicketPage in Hebrew', () => {
    // NewTicketPage requires an authenticated user. A Mechanic skips the
    // mechanic-roster fetch, keeping this a pure synchronous render check.
    vi.mocked(getStoredUser).mockReturnValue({
      id: 5,
      username: 'david',
      full_name: 'דוד',
      email: null,
      role: 'Mechanic',
      is_active: true,
    });
    renderAt('/tickets/new', <NewTicketPage />);
    expect(
      screen.getByRole('heading', { name: 'פתיחת כרטיס עבודה חדש' })
    ).toBeInTheDocument();
    vi.mocked(getStoredUser).mockReturnValue(null);
  });

  it('/customers renders CustomersPage in Hebrew', () => {
    // CustomersPage requires an authenticated staff user (Manager/Secretary).
    vi.mocked(getStoredUser).mockReturnValue({
      id: 1,
      username: 'uri',
      full_name: 'אורי',
      email: null,
      role: 'Manager',
      is_active: true,
    });
    renderAt('/customers', <CustomersPage />);
    expect(screen.getByRole('heading', { name: 'לקוחות ורכבים' })).toBeInTheDocument();
    vi.mocked(getStoredUser).mockReturnValue(null);
  });

  it('/parts renders PartsPage in Hebrew', () => {
    // PartsPage requires an authenticated staff user (Manager/Secretary).
    vi.mocked(getStoredUser).mockReturnValue({
      id: 1,
      username: 'uri',
      full_name: 'אורי',
      email: null,
      role: 'Manager',
      is_active: true,
    });
    renderAt('/parts', <PartsPage />);
    expect(screen.getByRole('heading', { name: 'מלאי חלקים' })).toBeInTheDocument();
    vi.mocked(getStoredUser).mockReturnValue(null);
  });

  it('/reports renders ReportsPage in Hebrew', async () => {
    renderAt('/reports', <ReportsPage />);
    expect(await screen.findByRole('heading', { name: 'דוחות' })).toBeInTheDocument();
  });

  it('/users renders UsersPage in Hebrew', () => {
    // UsersPage requires an authenticated Manager (Stage 9).
    vi.mocked(getStoredUser).mockReturnValue({
      id: 1,
      username: 'uri',
      full_name: 'אורי',
      email: null,
      role: 'Manager',
      is_active: true,
    });
    renderAt('/users', <UsersPage />);
    expect(screen.getByRole('heading', { name: 'ניהול משתמשים' })).toBeInTheDocument();
    vi.mocked(getStoredUser).mockReturnValue(null);
  });

  it('unknown path renders NotFoundPage in Hebrew', () => {
    renderAt('/unknown', <NotFoundPage />);
    expect(screen.getByRole('heading', { name: 'הדף לא נמצא' })).toBeInTheDocument();
  });
});
