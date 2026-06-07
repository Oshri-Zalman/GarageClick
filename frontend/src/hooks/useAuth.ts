import type { User } from '../types';
import { getStoredUser } from '../services/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

// The current user is cached synchronously in session storage at login, so there
// is no asynchronous fetch to wait on — we read it directly on every render.
export function useAuth(): AuthState {
  return { user: getStoredUser(), loading: false, error: null };
}
