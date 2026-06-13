import { logout } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { roleLabel } from '../config/roles';

interface Props {
  userName?: string;
  userRole?: string;
}

export default function Header({ userName, userRole }: Props) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between bg-amber-700 px-6 py-3 text-white shadow-md">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold tracking-wide">🔧 GarageClick</span>
      </div>
      {userName && (
        <div className="flex items-center gap-4">
          <span className="text-sm">
            {userName}
            {userRole && (
              <span className="mr-2 rounded-full bg-amber-600 px-2 py-0.5 text-xs">
                {roleLabel(userRole)}
              </span>
            )}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-md bg-amber-800 px-3 py-1.5 text-sm hover:bg-amber-900 transition-colors"
          >
            יציאה
          </button>
        </div>
      )}
    </header>
  );
}
