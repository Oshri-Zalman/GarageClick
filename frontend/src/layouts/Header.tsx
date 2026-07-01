import { useEffect, useRef, useState } from 'react';
import { logout } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { roleLabel } from '../config/roles';
import ChangePasswordDialog from '../components/ChangePasswordDialog';

interface Props {
  userName?: string;
  userRole?: string;
}

export default function Header({ userName, userRole }: Props) {
  const navigate = useNavigate();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const openChangePassword = () => {
    setMenuOpen(false);
    setChangePasswordOpen(true);
  };

  // Close the menu on an outside click or Escape, so it behaves like a normal
  // dropdown. The listener is only attached while the menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="flex items-center justify-between bg-amber-700 px-6 py-3 text-white shadow-md">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold tracking-wide">🔧 GarageClick</span>
      </div>

      {userName && (
        <div className="relative" ref={menuRef}>
          {/* The whole identity area is the menu trigger — "החלפת סיסמה" and
              "יציאה" live inside the dropdown, not as standalone header buttons. */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="תפריט משתמש"
            className="flex items-center gap-2 rounded-md bg-amber-800 px-3 py-1.5 text-sm transition-colors hover:bg-amber-900"
          >
            <span>{userName}</span>
            {userRole && (
              <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs">
                {roleLabel(userRole)}
              </span>
            )}
            <span aria-hidden="true" className="text-xs">▼</span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="פעולות משתמש"
              className="absolute left-0 z-50 mt-2 w-44 overflow-hidden rounded-md bg-white text-gray-800 shadow-lg ring-1 ring-black/10"
            >
              <button
                type="button"
                role="menuitem"
                onClick={openChangePassword}
                className="block w-full px-4 py-2 text-right text-sm transition-colors hover:bg-amber-50"
              >
                החלפת סיסמה
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="block w-full px-4 py-2 text-right text-sm transition-colors hover:bg-amber-50"
              >
                יציאה
              </button>
            </div>
          )}
        </div>
      )}

      {changePasswordOpen && (
        <ChangePasswordDialog onClose={() => setChangePasswordOpen(false)} />
      )}
    </header>
  );
}
