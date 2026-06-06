import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'לוח בקרה', icon: '🏠' },
  { to: '/kanban', label: 'לוח קנבן', icon: '📋' },
  { to: '/tickets/new', label: 'קריאה חדשה', icon: '➕' },
  { to: '/customers', label: 'לקוחות ורכבים', icon: '🚗' },
  { to: '/parts', label: 'מלאי חלקים', icon: '🔩', roles: ['Manager', 'Secretary'] },
  { to: '/reports', label: 'דוחות', icon: '📊', roles: ['Manager'] },
  { to: '/users', label: 'ניהול משתמשים', icon: '👥', roles: ['Manager'] },
];

interface Props {
  userRole?: string;
}

export default function Sidebar({ userRole }: Props) {
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (userRole && item.roles.includes(userRole))
  );

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
