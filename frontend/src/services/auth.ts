import apiClient from './apiClient';
import type { AuthToken, User } from '../types';

export async function login(username: string, password: string): Promise<AuthToken> {
  const { data } = await apiClient.post<AuthToken>('/auth/login', { username, password });
  sessionStorage.setItem('access_token', data.token);
  const user: User = {
    id: data.user_id,
    username,
    full_name: data.full_name,
    email: null,
    role: data.role,
    is_active: true,
  };
  sessionStorage.setItem('current_user', JSON.stringify(user));
  return data;
}

export async function logout(): Promise<void> {
  // Always clear the local session even if the network call fails — the user
  // intent is to be logged out, and a stale token must never linger.
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // ignore: server-side session cleanup is best-effort
  } finally {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('current_user');
  }
}

// Synchronously reads the user cached in sessionStorage at login, or null when
// nobody is signed in. Used by route guards that need the role immediately.
export function getStoredUser(): User | null {
  const stored = sessionStorage.getItem('current_user');
  return stored ? (JSON.parse(stored) as User) : null;
}

// Reads the user cached in sessionStorage at login — avoids calling a /me endpoint
// that does not exist in the backend at this stage.
export async function getCurrentUser(): Promise<User> {
  const user = getStoredUser();
  if (user) {
    return user;
  }
  throw new Error('No authenticated user in session');
}

export function isAuthenticated(): boolean {
  return !!sessionStorage.getItem('access_token');
}

// POST /api/auth/change-password — self-service password change for any
// authenticated user. The backend verifies `current_password`, then sets
// `new_password` (min 6 chars). On success the existing session stays valid, so
// the user is kept signed in. Errors (incorrect current password -> 400,
// unauthenticated -> 401, too short -> 422) are propagated to the caller.
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiClient.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
