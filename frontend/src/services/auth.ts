import apiClient from './apiClient';
import type { AuthToken, User } from '../types';

export async function login(username: string, password: string): Promise<AuthToken> {
  const { data } = await apiClient.post<AuthToken>('/auth/login', { username, password });
  sessionStorage.setItem('access_token', data.access_token);
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
  sessionStorage.removeItem('access_token');
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

export function isAuthenticated(): boolean {
  return !!sessionStorage.getItem('access_token');
}
