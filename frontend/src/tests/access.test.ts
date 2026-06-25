import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Role } from '../types';

const ROLES: Role[] = ['Manager', 'Secretary', 'Mechanic'];

describe('role access config', () => {
  afterEach(() => {
    vi.resetModules();
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

  it('Mechanic can access Kanban, My Tickets and New Ticket only among the restricted set', async () => {
    const { canAccess } = await import('../config/access');
    expect(canAccess('Mechanic', '/kanban')).toBe(true);
    expect(canAccess('Mechanic', '/my-tickets')).toBe(true);
    expect(canAccess('Mechanic', '/tickets/new')).toBe(true);
    expect(canAccess('Mechanic', '/dashboard')).toBe(false);
    expect(canAccess('Mechanic', '/customers')).toBe(false);
    expect(canAccess('Mechanic', '/parts')).toBe(false);
    expect(canAccess('Mechanic', '/reports')).toBe(false);
    expect(canAccess('Mechanic', '/users')).toBe(false);
  });

  it('all roles can create a new ticket', async () => {
    const { canAccess } = await import('../config/access');
    expect(canAccess('Manager', '/tickets/new')).toBe(true);
    expect(canAccess('Secretary', '/tickets/new')).toBe(true);
    expect(canAccess('Mechanic', '/tickets/new')).toBe(true);
  });

  it('every role can access the ticket archive (ארכיון כרטיסים)', async () => {
    const { canAccess } = await import('../config/access');
    expect(canAccess('Manager', '/my-tickets')).toBe(true);
    expect(canAccess('Mechanic', '/my-tickets')).toBe(true);
    expect(canAccess('Secretary', '/my-tickets')).toBe(true);
  });

  it('home path routes mechanics to kanban and others to dashboard', async () => {
    const { homePathForRole } = await import('../config/access');
    expect(homePathForRole('Manager')).toBe('/dashboard');
    expect(homePathForRole('Secretary')).toBe('/dashboard');
    expect(homePathForRole('Mechanic')).toBe('/kanban');
  });

  it('exposes the expected nav items per role', async () => {
    const { navItemsForRole } = await import('../config/access');

    const managerPaths = navItemsForRole('Manager').map((i) => i.to);
    expect(managerPaths).toContain('/users');
    expect(managerPaths).toContain('/my-tickets');
    // Employee monitoring lives inside the Manager Dashboard (/dashboard), so the
    // standalone /manager-dashboard page is no longer a sidebar nav item (Stage 10).
    expect(managerPaths).not.toContain('/manager-dashboard');
    // Reports are redundant with the report-like sections inside the Manager
    // Dashboard, so /reports is no longer a sidebar nav item for any role. The
    // route itself is kept (allowedRoles) for backward compatibility.
    expect(managerPaths).not.toContain('/reports');

    const secretaryPaths = navItemsForRole('Secretary').map((i) => i.to);
    expect(secretaryPaths).toContain('/parts');
    // The ticket archive (ארכיון כרטיסים) is now available to every role.
    expect(secretaryPaths).toContain('/my-tickets');
    // New Ticket is opened from the Work Board modal, not a sidebar nav item.
    expect(secretaryPaths).not.toContain('/tickets/new');
    expect(secretaryPaths).not.toContain('/reports');

    const mechanicPaths = navItemsForRole('Mechanic').map((i) => i.to);
    expect(mechanicPaths).toContain('/kanban');
    expect(mechanicPaths).toContain('/my-tickets');
    expect(mechanicPaths).not.toContain('/tickets/new');
    expect(mechanicPaths).not.toContain('/parts');
    expect(mechanicPaths).not.toContain('/customers');
    expect(mechanicPaths).not.toContain('/reports');
  });

  it('shared/unknown routes are open to all signed-in roles', async () => {
    const { canAccess } = await import('../config/access');
    for (const role of ROLES) {
      expect(canAccess(role, '/some-shared-route')).toBe(true);
    }
  });

  it('only Manager/Secretary may manage customers; Mechanic may not', async () => {
    const { canManageCustomers } = await import('../config/access');
    expect(canManageCustomers('Manager')).toBe(true);
    expect(canManageCustomers('Secretary')).toBe(true);
    expect(canManageCustomers('Mechanic')).toBe(false);
  });

  it('only Manager/Secretary may manage the parts inventory; Mechanic may not', async () => {
    const { canManageParts } = await import('../config/access');
    expect(canManageParts('Manager')).toBe(true);
    expect(canManageParts('Secretary')).toBe(true);
    expect(canManageParts('Mechanic')).toBe(false);
  });
});
