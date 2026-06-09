import { useAuth } from '../hooks/useAuth';
import TicketCreationFlow from '../components/TicketCreationFlow';

// Standalone New Ticket page, kept at /tickets/new for direct access and
// backward compatibility. The main user flow is the Work Board modal, but the
// page reuses the exact same TicketCreationFlow so there is no duplicated logic.
export default function NewTicketPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-gray-800">פתיחת כרטיס עבודה חדש</h1>
      <TicketCreationFlow user={user} />
    </div>
  );
}
