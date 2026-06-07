import type { Role } from '../types';
import { features } from './features';

// Single source of truth for role-based access. Both the sidebar navigation and
// the route guards derive their behaviour from the helpers here so the two can
// never drift apart.

export interface NavItem {
  to: string;
  label: string;
  icon: string;
}

// Every navigable page in the app, in display order. Visibility per role is
// resolved through `allowedRoles` below, not duplicated here.
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'לוח בקרה', icon: '🏠' },
  { to: '/kanban', label: 'לוח קנבן', icon: '📋' },
  { to: '/my-tickets', label: 'הכרטיסים שלי', icon: '🧾' },
  { to: '/tickets/new', label: 'קריאה חדשה', icon: '➕' },
  { to: '/customers', label: 'לקוחות ורכבים', icon: '🚗' },
  { to: '/parts', label: 'מלאי חלקים', icon: '🔩' },
  { to: '/manager-dashboard', label: 'ניטור עובדים', icon: '📈' },
  { to: '/reports', label: 'דוחות', icon: '📊' },
  { to: '/users', label: 'ניהול משתמשים', icon: '👥' },
];

const ALL_ROLES: Role[] = ['Manager', 'Secretary', 'Mechanic'];

// Roles permitted to access a given route path. Reads the live feature flag so
// tests (and runtime config) can toggle mechanic ticket creation.
export function allowedRoles(path: string): Role[] {
  switch (path) {
    case '/dashboard':
    case '/customers':
    case '/parts':
      return ['Manager', 'Secretary'];
    case '/kanban':
      return ['Manager', 'Secretary', 'Mechanic'];
    case '/tickets/new':
      return features.enableMechanicTicketCreation
        ? ['Manager', 'Secretary', 'Mechanic']
        : ['Manager', 'Secretary'];
    case '/my-tickets':
      return ['Mechanic'];
    case '/manager-dashboard':
    case '/reports':
    case '/users':
      return ['Manager'];
    default:
      // Shared/utility routes (e.g. not-found) are open to any signed-in user.
      return ALL_ROLES;
  }
}

// True when the given role may access the given route path.
export function canAccess(role: Role, path: string): boolean {
  return allowedRoles(path).includes(role);
}

// Navigation items visible to a given role.
export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => canAccess(role, item.to));
}

// The landing page a role should be sent to after login or when they hit a
// route they are not allowed to see. Mechanics live in the Kanban board;
// everyone else gets the dashboard.
export function homePathForRole(role: Role): string {
  return role === 'Mechanic' ? '/kanban' : '/dashboard';
}
