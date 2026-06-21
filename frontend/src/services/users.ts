import apiClient from './apiClient';
import type { CreateUserInput, ManagedUser, UpdateUserInput } from '../types';

// User management service — wraps the Manager-only endpoints under
// /api/admin/users (TDD §4.6, FR-6.4 / Stage 9). Every route is guarded by
// require_roles("Manager") on the backend, so these must only be called from the
// Manager user-management screen (Secretary/Mechanic receive 403). Errors are
// propagated so callers can show a Hebrew error/empty/retry state.

// GET /api/admin/users — full user list (incl. username + is_active). The
// backend never returns password_hash.
export async function listUsers(): Promise<ManagedUser[]> {
  const { data } = await apiClient.get<ManagedUser[]>('/admin/users');
  return data;
}

// POST /api/admin/users — create a user with a temporary password. Returns the
// created user row (201). Duplicate username -> 409.
export async function createUser(input: CreateUserInput): Promise<ManagedUser> {
  const { data } = await apiClient.post<ManagedUser>('/admin/users', input);
  return data;
}

// PATCH /api/admin/users/{id} — partial update: edit name/role, activate or
// deactivate (is_active), or reset the temporary password (password). Only the
// fields present in `input` are changed. Unknown user -> 404.
export async function updateUser(id: number, input: UpdateUserInput): Promise<ManagedUser> {
  const { data } = await apiClient.patch<ManagedUser>(`/admin/users/${id}`, input);
  return data;
}

// DELETE /api/admin/users/{id} — hard-delete a user. Blocked by the backend when
// the user is the caller (400) or is referenced by tickets/history (409); in
// those cases deactivate via PATCH is_active=false instead.
export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/admin/users/${id}`);
}
