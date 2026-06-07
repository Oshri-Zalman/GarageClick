import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import KanbanBoard from '../components/KanbanBoard';

export default function KanbanPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">כרטיסי עבודה</h1>
        <Link
          to="/tickets/new"
          className="rounded-lg bg-orange-500 px-5 py-3 text-base font-bold text-white shadow-md transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
        >
          ＋ פתיחת כרטיס עבודה חדש
        </Link>
      </div>
      {user && <KanbanBoard user={user} />}
    </div>
  );
}
