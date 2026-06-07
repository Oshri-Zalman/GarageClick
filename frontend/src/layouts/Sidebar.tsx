import { NavLink } from 'react-router-dom';
import type { Role } from '../types';
import { navItemsForRole } from '../config/access';

interface Props {
  userRole?: Role;
}

export default function Sidebar({ userRole }: Props) {
  const visibleItems = userRole ? navItemsForRole(userRole) : [];

  return (
    <nav
      aria-label="ניווט ראשי"
      className="flex w-56 flex-col gap-1 bg-white py-4 shadow-sm border-l border-gray-200"
    >
      {visibleItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors rounded-md mx-2 ` +
            (isActive
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-700 hover:bg-gray-100')
          }
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
