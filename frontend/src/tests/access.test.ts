import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Role } from '../types';

const ROLES: Role[] = ['Manager', 'Secretary', 'Mechanic'];

describe('role access config', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../config/features');
  });

  it('Manager can access every restricted page', async () => {
    const { canAccess } = await import('../config/access');
    for (const path of ['/dashboard', '/kanban', '/customers', '/parts', '/manager-dashboard', '/reports', '/users']) {
      expect(canAccess('Manager', path)).toBe(true);
    }
  });

  it('Secretary can access operational pages but not manager tools', async () => {
    const { canAccess } = await import('../config/access');
    expect(canAccess('Secretary', '/dashboard')).toBe(true);
    expect(canAccess('Secretary', '/kanban')).toBe(true);
    expect(canAccess('Secretary', '/customers')).toBe(true);
    expect(canAccess('Secretary', '/parts')).toBe(true);
    expect(canAccess('Secretary', '/reports')).toBe(false);
    expect(canAccess('Secretary', '/users')).toBe(false);
    expect(canAccess('Secretary', '/manager-dashboard')).toBe(false);
  });

  it('Mechanic can access Kanban and My Tickets only among the restricted set', async () => {
    const { canAccess } = await import('../config/access');
    expect(canAccess('Mechanic', '/kanban')).toBe(true);
    expect(canAccess('Mechanic', '/my-tickets')).toBe(true);
    expect(canAccess('Mechanic', '/dashboard')).toBe(false);
    expect(canAccess('Mechanic', '/customers')).toBe(false);
    expect(canAccess('Mechanic', '/parts')).toBe(false);
    expect(canAccess('Mechanic', '/reports')).toBe(false);
    expect(canAccess('Mechanic', '/users')).toBe(false);
  });

  it('home path routes mechanics to kanban and others to dashboard', async () => {
    const { homePathForRole } = await import('../config/access');
    expect(homePathForRole('Manager')).toBe('/dashboard');
    expect(homePathForRole('Secretary')).toBe('/dashboard');
    expect(homePathForRole('Mechanic')).toBe('/kanban');
  });

  it('only my-tickets and manager pages are role-exclusive in the nav', async () => {
    const { navItemsForRole } = await import('../config/access');
    const managerPaths = navItemsForRole('Manager').map((i) => i.to);
    expect(managerPaths).toContain('/reports');
    expect(managerPaths).toContain('/users');
    expect(managerPaths).toContain('/manager-dashboard');
    expect(managerPaths).not.toContain('/my-tickets');

    const mechanicPaths = navItemsForRole('Mechanic').map((i) => i.to);
    expect(mechanicPaths).toContain('/kanban');
    expect(mechanicPaths).toContain('/my-tickets');
    expect(mechanicPaths).not.toContain('/parts');
  });

  describe('mechanic ticket creation feature flag', () => {
    it('hides New Ticket from mechanics when the flag is off (default)', async () => {
      const { canAccess, navItemsForRole } = await import('../config/access');
      expect(canAccess('Mechanic', '/tickets/new')).toBe(false);
      expect(navItemsForRole('Mechanic').map((i) => i.to)).not.toContain('/tickets/new');
      // Managers and secretaries always keep ticket creation.
      expect(canAccess('Manager', '/tickets/new')).toBe(true);
      expect(canAccess('Secretary', '/tickets/new')).toBe(true);
    });

    it('exposes New Ticket to mechanics when the flag is on', async () => {
      vi.doMock('../config/features', () => ({
        features: { enableMechanicTicketCreation: true },
      }));
      const { canAccess, navItemsForRole } = await import('../config/access');
      expect(canAccess('Mechanic', '/tickets/new')).toBe(true);
      expect(navItemsForRole('Mechanic').map((i) => i.to)).toContain('/tickets/new');
    });
  });

  it('shared/unknown routes are open to all signed-in roles', async () => {
    const { canAccess } = await import('../config/access');
    for (const role of ROLES) {
      expect(canAccess(role, '/some-shared-route')).toBe(true);
    }
  });
});
