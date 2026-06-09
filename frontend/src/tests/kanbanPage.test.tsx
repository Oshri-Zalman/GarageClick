import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import KanbanPage from '../pages/KanbanPage';
import type { User } from '../types';

// The board fetches tickets on mount — stub it so this page-level test focuses
// on the title and the primary CTA only. createTicket is stubbed because the
// modal's flow imports it (it is only invoked on an explicit submit).
vi.mock('../services/tickets', () => ({
  listTickets: vi.fn().mockResolvedValue([]),
  updateTicketStatus: vi.fn(),
  createTicket: vi.fn(),
}));

const MECHANIC: User = {
  id: 7,
  username: 'david',
  full_name: 'דוד',
  email: null,
  role: 'Mechanic',
  is_active: true,
};

vi.mock('../services/auth', () => ({
  getStoredUser: () => MECHANIC,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/kanban']}>
      <Routes>
        <Route path="/kanban" element={<KanbanPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('KanbanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the refined page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'לוח עבודה' })).toBeInTheDocument();
  });

  it('renders a prominent CTA button (not a link to a separate page)', () => {
    renderPage();
    const cta = screen.getByRole('button', { name: /פתיחת כרטיס עבודה חדש/ });
    expect(cta).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /פתיחת כרטיס עבודה חדש/ })).not.toBeInTheDocument();
  });

  it('opens the ticket creation modal when the CTA is clicked', async () => {
    renderPage();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /פתיחת כרטיס עבודה חדש/ }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'פתיחת כרטיס עבודה חדש' })
    ).toBeInTheDocument();
  });
});
