import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, logout, getCurrentUser, isAuthenticated } from '../services/auth';

vi.mock('../services/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import apiClient from '../services/apiClient';

describe('auth service', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('stores access_token from response.token field in sessionStorage', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { token: 'test-jwt', user_id: 1, role: 'Manager', full_name: 'Uri Cohen' },
      });
      await login('uri', 'pass');
      expect(sessionStorage.getItem('access_token')).toBe('test-jwt');
    });

    it('stores current_user in sessionStorage with correct shape', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { token: 'test-jwt', user_id: 2, role: 'Secretary', full_name: 'Sara Levi' },
      });
      await login('sara', 'pass');
      const stored = JSON.parse(sessionStorage.getItem('current_user')!);
      expect(stored.id).toBe(2);
      expect(stored.username).toBe('sara');
      expect(stored.role).toBe('Secretary');
      expect(stored.full_name).toBe('Sara Levi');
    });
  });

  describe('getCurrentUser', () => {
    it('returns the user stored in sessionStorage without making an API call', async () => {
      const user = { id: 1, username: 'uri', full_name: 'Uri Cohen', email: null, role: 'Manager', is_active: true };
      sessionStorage.setItem('current_user', JSON.stringify(user));
      const result = await getCurrentUser();
      expect(result).toEqual(user);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('throws when no user is stored in sessionStorage', async () => {
      await expect(getCurrentUser()).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('clears both access_token and current_user from sessionStorage', async () => {
      sessionStorage.setItem('access_token', 'some-token');
      sessionStorage.setItem('current_user', JSON.stringify({ id: 1 }));
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: {} });
      await logout();
      expect(sessionStorage.getItem('access_token')).toBeNull();
      expect(sessionStorage.getItem('current_user')).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no token in sessionStorage', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('returns true when token exists in sessionStorage', () => {
      sessionStorage.setItem('access_token', 'some-token');
      expect(isAuthenticated()).toBe(true);
    });
  });
});
