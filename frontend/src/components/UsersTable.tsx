import type { ManagedUser } from '../types';
import UserRoleBadge from './UserRoleBadge';
import UserStatusBadge from './UserStatusBadge';

interface Props {
  users: ManagedUser[];
  // The signed-in manager's id, used to label/identify their own row.
  currentUserId: number;
  onEdit: (user: ManagedUser) => void;
  onToggleActive: (user: ManagedUser) => void;
  onResetPassword: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
}

// Users table for the Manager user-management screen (FR-6.4 / Stage 9). Shows
// full name, username, role, active status and per-row actions. RTL, compact,
// styled within the GarageClick orange/amber family.
export default function UsersTable({
  users,
  currentUserId,
  onEdit,
  onToggleActive,
  onResetPassword,
  onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-right text-sm" aria-label="טבלת משתמשים">
        <thead>
          <tr className="border-b border-gray-200 bg-amber-50 text-gray-700">
            <th scope="col" className="px-4 py-3 font-semibold">
              שם מלא
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              שם משתמש
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              תפקיד
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              סטטוס
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              פעולות
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <tr key={user.id} className="border-b border-gray-100 last:border-b-0">
                <td className="px-4 py-3 font-semibold text-gray-800">
                  {user.full_name ?? '—'}
                  {isSelf && <span className="mr-1 text-xs font-normal text-gray-400">(אתה)</span>}
                </td>
                <td className="px-4 py-3 text-gray-600" dir="ltr">
                  {user.username}
                </td>
                <td className="px-4 py-3">
                  <UserRoleBadge role={user.role} />
                </td>
                <td className="px-4 py-3">
                  <UserStatusBadge active={user.is_active} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(user)}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      ערוך
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleActive(user)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        user.is_active
                          ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                          : 'border-green-300 text-green-800 hover:bg-green-50'
                      }`}
                    >
                      {user.is_active ? 'השבת' : 'הפעל'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onResetPassword(user)}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      איפוס סיסמה
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(user)}
                      className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                    >
                      מחק
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
