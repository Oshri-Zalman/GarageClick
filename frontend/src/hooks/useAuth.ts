import { useState, useEffect } from 'react';
import type { User } from '../types';
import { getCurrentUser, isAuthenticated } from '../services/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      setState({ user: null, loading: false, error: null });
      return;
    }

    getCurrentUser()
      .then((user) => setState({ user, loading: false, error: null }))
      .catch(() => setState({ user: null, loading: false, error: 'שגיאה בטעינת המשתמש' }));
  }, []);

  return state;
}
