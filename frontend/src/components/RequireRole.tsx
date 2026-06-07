import { Navigate, Outlet } from 'react-router-dom';
import type { Role } from '../types';
import { getStoredUser } from '../services/auth';
import { homePathForRole } from '../config/access';

interface Props {
  roles: Role[];
}

// Route-level guard. Renders the nested routes only when the signed-in user's
// role is permitted; otherwise sends them somewhere they are allowed to be:
// unauthenticated users to /login, authenticated-but-forbidden users back to
// their own home page. Reads the role synchronously from session storage, so it
// must sit inside AppLayout which has already confirmed authentication.
export default function RequireRole({ roles }: Props) {
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return <Outlet />;
}

// Index redirect for "/": sends each role to its natural landing page.
export function RoleHomeRedirect() {
  const user = getStoredUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={homePathForRole(user.role)} replace />;
}
