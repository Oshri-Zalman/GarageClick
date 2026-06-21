import type { Role } from '../types';

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
  { to: '/kanban', label: 'לוח עבודה', icon: '📋' },
  { to: '/my-tickets', label: 'ארכיון כרטיסים', icon: '🗄️' },
  // New Ticket is opened from a modal on the Work Board, not as a sidebar item.
  // The /tickets/new route still exists (see allowedRoles) for direct access.
  { to: '/customers', label: 'לקוחות ורכבים', icon: '🚗' },
  { to: '/parts', label: 'מלאי חלקים', icon: '🔩' },
  // "ניטור עובדים" intentionally has no sidebar entry: employee monitoring lives
  // inside the Manager Dashboard at /dashboard (see ManagerDashboard). The
  // /manager-dashboard route is kept for backward compatibility (allowedRoles
  // below) but is no longer surfaced in navigation.
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
    case '/tickets/new':
      // Kanban and ticket creation are available to all roles, including
      // mechanics (a mechanic always opens tickets on themselves).
      return ['Manager', 'Secretary', 'Mechanic'];
    case '/my-tickets':
      // Ticket archive ("ארכיון כרטיסים") — open to every role. Visibility is
      // scoped inside the page: Mechanic sees their own archive, Secretary sees
      // the garage archive, Manager toggles between personal and garage archives.
      return ['Manager', 'Secretary', 'Mechanic'];
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

// True when the role may create/edit customers and vehicles from the dedicated
// Customers & Vehicles management page. Mirrors the backend: PUT /api/customers
// and PUT /api/vehicles are restricted to STAFF (Manager/Secretary). Mechanics
// never reach the page (see allowedRoles('/customers')), but this keeps the
// edit-action gating explicit and testable.
export function canManageCustomers(role: Role): boolean {
  return role === 'Manager' || role === 'Secretary';
}

// True when the role may manage the parts inventory (create/edit parts, update
// quantities). Mirrors the backend: the inventory endpoints under /api/parts are
// restricted to STAFF (Manager/Secretary); mechanics are blocked at the route
// guard (see allowedRoles('/parts')), but this keeps action gating explicit.
export function canManageParts(role: Role): boolean {
  return role === 'Manager' || role === 'Secretary';
}

// The landing page a role should be sent to after login or when they hit a
// route they are not allowed to see. Mechanics live in the Kanban board;
// everyone else gets the dashboard.
export function homePathForRole(role: Role): string {
  return role === 'Mechanic' ? '/kanban' : '/dashboard';
}
