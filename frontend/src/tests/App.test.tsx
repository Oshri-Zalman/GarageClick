import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

// Mock useAuth so tests don't make real API calls
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false, error: null }),
}));

// Mock auth service to avoid sessionStorage/navigation side-effects
vi.mock('../services/auth', () => ({
  isAuthenticated: () => false,
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/login');
  });

  it('renders the login page at /login', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /garageclick/i })).toBeInTheDocument();
  });

  it('renders the login form fields in Hebrew', () => {
    render(<App />);
    expect(screen.getByLabelText('שם משתמש')).toBeInTheDocument();
    expect(screen.getByLabelText('סיסמה')).toBeInTheDocument();
  });

  it('renders the submit button with Hebrew label', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'כניסה' })).toBeInTheDocument();
  });
});
