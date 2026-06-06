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
  await apiClient.post('/auth/logout');
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('current_user');
}

// Reads the user cached in sessionStorage at login — avoids calling a /me endpoint
// that does not exist in the backend at this stage.
export async function getCurrentUser(): Promise<User> {
  const stored = sessionStorage.getItem('current_user');
  if (stored) {
    return JSON.parse(stored) as User;
  }
  throw new Error('No authenticated user in session');
}

export function isAuthenticated(): boolean {
  return !!sessionStorage.getItem('access_token');
}
