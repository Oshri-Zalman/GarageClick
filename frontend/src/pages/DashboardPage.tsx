import { useAuth } from '../hooks/useAuth';
import ManagerDashboard from '../components/ManagerDashboard';
import SecretaryDashboard from '../components/SecretaryDashboard';

// Role-appropriate dashboard (Stage 8 / SRS §3, FR-6). The route guard restricts
// /dashboard to Manager and Secretary (mechanics are redirected to their Kanban
// home — see config/access), so only those two views are rendered here. The
// Manager view adds the manager-only monitoring and reports; the Secretary view
// shows a general operational summary computed from the tickets they can read.
export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">לוח בקרה</h1>
      </div>

      {user?.role === 'Manager' && <ManagerDashboard />}
      {user?.role === 'Secretary' && <SecretaryDashboard />}
    </div>
  );
}
