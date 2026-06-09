import apiClient from './apiClient';
import type { Mechanic, Role } from '../types';

// Only a Mechanic or a hands-on Manager may be assigned the work — never a
// Secretary (mirrors the backend rule in tickets.create_ticket).
const ASSIGNABLE_ROLES: Role[] = ['Mechanic', 'Manager'];

// Fallback roster used when no shared mechanics endpoint is reachable. The only
// listing endpoint today, GET /api/admin/employees, is Manager-only, so a
// Secretary falls back to these until a Secretary-accessible endpoint exists.
// (See the Stage 4 "backend assumptions" note.)
export const MOCK_MECHANICS: Mechanic[] = [
  { id: 5, name: 'דוד', role: 'Mechanic' },
  { id: 6, name: 'יוסי', role: 'Mechanic' },
  { id: 7, name: 'אבי', role: 'Mechanic' },
];

interface EmployeeRow {
  id: number;
  name: string | null;
  role: Role;
}

// Returns the workers a Manager/Secretary can assign a ticket to. Tries the real
// Manager-only endpoint first and degrades gracefully to MOCK_MECHANICS when it
// is not reachable (403 for a Secretary, or no backend in dev/tests).
export async function listMechanics(): Promise<Mechanic[]> {
  try {
    const { data } = await apiClient.get<EmployeeRow[]>('/admin/employees');
    const assignable = data
      .filter((e) => ASSIGNABLE_ROLES.includes(e.role))
      .map((e) => ({ id: e.id, name: e.name ?? `#${e.id}`, role: e.role }));
    return assignable.length > 0 ? assignable : MOCK_MECHANICS;
  } catch {
    return MOCK_MECHANICS;
  }
}
