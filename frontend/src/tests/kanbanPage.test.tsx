import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import KanbanPage from '../pages/KanbanPage';
import type { User } from '../types';

// The board fetches tickets on mount — stub it so this page-level test focuses
// on the title and the primary CTA only.
vi.mock('../services/tickets', () => ({
  listTickets: vi.fn().mockResolvedValue([]),
  updateTicketStatus: vi.fn(),
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
        <Route path="/tickets/new" element={<div>טופס כרטיס עבודה חדש</div>} />
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

  it('renders a prominent CTA that links to the New Ticket route', () => {
    renderPage();
    const cta = screen.getByRole('link', { name: /פתיחת כרטיס עבודה חדש/ });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/tickets/new');
  });

  it('navigates to the New Ticket route when the CTA is clicked', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('link', { name: /פתיחת כרטיס עבודה חדש/ }));
    expect(await screen.findByText('טופס כרטיס עבודה חדש')).toBeInTheDocument();
  });
});
