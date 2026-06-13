import type { Role } from '../types';

// Single source of truth for the Hebrew display label of each role. Shared by the
// header badge and the dashboard tables so they can never drift apart.
export const ROLE_LABELS: Record<Role, string> = {
  Manager: 'מנהל',
  Secretary: 'מזכירה',
  Mechanic: 'מכונאי',
};

// Safe lookup that tolerates an unknown role string (falls back to the raw value).
export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}
