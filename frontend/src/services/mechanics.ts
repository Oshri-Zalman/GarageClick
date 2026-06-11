import apiClient from './apiClient';
import type { Mechanic, Role } from '../types';

// Shape returned by GET /api/mechanics — the shared, Manager+Secretary endpoint
// for the ticket "עובד מטפל" dropdown. The backend already restricts this to
// active, assignable users (Mechanic + Manager) and exposes only these minimal,
// non-sensitive fields (see backend/app/routers/mechanics.py).
interface AssignableMechanicRow {
  id: number;
  username: string;
  full_name: string | null;
  role: Role;
}

// Returns the workers a Manager/Secretary may assign a ticket to, from the real
// GET /api/mechanics endpoint. Errors are intentionally propagated so the caller
// can surface a clear message and a safe empty state — we never fall back to
// fabricated mechanic ids (the previous MOCK_MECHANICS Secretary fallback is
// gone now that the backend exposes a Secretary-accessible endpoint).
export async function listMechanics(): Promise<Mechanic[]> {
  const { data } = await apiClient.get<AssignableMechanicRow[]>('/mechanics');
  return data.map((m) => ({
    id: m.id,
    name: m.full_name ?? m.username,
    role: m.role,
  }));
}
