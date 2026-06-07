import { useAuth } from '../hooks/useAuth';
import KanbanBoard from '../components/KanbanBoard';

export default function KanbanPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">לוח קנבן</h1>
      {user && <KanbanBoard user={user} />}
    </div>
  );
}
