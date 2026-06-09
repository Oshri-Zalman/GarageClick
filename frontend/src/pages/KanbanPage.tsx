import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import KanbanBoard from '../components/KanbanBoard';
import NewTicketModal from '../components/NewTicketModal';

export default function KanbanPage() {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  // Bumping this remounts the board so a freshly created ticket is fetched.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">לוח עבודה</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-orange-500 px-5 py-3 text-base font-bold text-white shadow-md transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
        >
          ＋ פתיחת כרטיס עבודה חדש
        </button>
      </div>

      {user && <KanbanBoard key={refreshKey} user={user} />}

      {user && modalOpen && (
        <NewTicketModal
          user={user}
          onClose={() => setModalOpen(false)}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
