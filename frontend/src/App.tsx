import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import RequireRole, { RoleHomeRedirect } from './components/RequireRole';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import KanbanPage from './pages/KanbanPage';
import MyTicketsPage from './pages/MyTicketsPage';
import NewTicketPage from './pages/NewTicketPage';
import CustomersPage from './pages/CustomersPage';
import PartsPage from './pages/PartsPage';
import ManagerDashboardPage from './pages/ManagerDashboardPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import NotFoundPage from './pages/NotFoundPage';
import { allowedRoles } from './config/access';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* AppLayout enforces authentication; RequireRole enforces role access. */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<RoleHomeRedirect />} />

          <Route element={<RequireRole roles={allowedRoles('/dashboard')} />}>
            <Route path="dashboard" element={<DashboardPage />} />
          </Route>
          <Route element={<RequireRole roles={allowedRoles('/kanban')} />}>
            <Route path="kanban" element={<KanbanPage />} />
          </Route>
          <Route element={<RequireRole roles={allowedRoles('/my-tickets')} />}>
            <Route path="my-tickets" element={<MyTicketsPage />} />
          </Route>
          <Route element={<RequireRole roles={allowedRoles('/tickets/new')} />}>
            <Route path="tickets/new" element={<NewTicketPage />} />
          </Route>
          <Route element={<RequireRole roles={allowedRoles('/customers')} />}>
            <Route path="customers" element={<CustomersPage />} />
          </Route>
          <Route element={<RequireRole roles={allowedRoles('/parts')} />}>
            <Route path="parts" element={<PartsPage />} />
          </Route>
          <Route element={<RequireRole roles={allowedRoles('/manager-dashboard')} />}>
            <Route path="manager-dashboard" element={<ManagerDashboardPage />} />
          </Route>
          <Route element={<RequireRole roles={allowedRoles('/reports')} />}>
            <Route path="reports" element={<ReportsPage />} />
          </Route>
          <Route element={<RequireRole roles={allowedRoles('/users')} />}>
            <Route path="users" element={<UsersPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
