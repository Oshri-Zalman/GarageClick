import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { CreateUserInput, ManagedUser, UpdateUserInput } from '../types';
import { listUsers, createUser, updateUser, deleteUser } from '../services/users';
import { userErrorMessage } from '../utils/userErrors';
import UsersTable from '../components/UsersTable';
import UserForm from '../components/UserForm';
import ResetPasswordDialog from '../components/ResetPasswordDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

// Which create/edit form (if any) is open.
type FormState = { kind: 'none' } | { kind: 'create' } | { kind: 'edit'; user: ManagedUser };

// Which confirmation/dialog (if any) is open for a single user.
type DialogState =
  | { kind: 'none' }
  | { kind: 'toggle'; user: ManagedUser }
  | { kind: 'delete'; user: ManagedUser }
  | { kind: 'reset'; user: ManagedUser };

const userName = (u: ManagedUser) => u.full_name ?? u.username;

// Stage 9 — Manager-only user management screen (FR-6.4). Lists users from
// GET /api/admin/users and supports create/edit, activate/deactivate, reset
// temporary password and delete via the /api/admin/users endpoints. The route is
// already restricted to Manager by the route guard (config/access — '/users').
export default function UsersPage() {
  const { user } = useAuth();

  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({ kind: 'none' });
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Error from a confirmation action (toggle/delete). Surfaced at the top of the
  // page once the dialog closes, so it is not hidden behind the modal overlay.
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetches the user list and folds it into state. State is only ever touched
  // asynchronously (inside the promise callbacks), so this is safe to call from
  // an effect without triggering cascading synchronous renders.
  const fetchUsers = useCallback(
    () =>
      listUsers()
        .then((rows) => setUsers(rows))
        .catch((err) => setLoadError(userErrorMessage(err, 'שגיאה בטעינת המשתמשים. נסה שוב.')))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reload handler (runs in an event/async context, so synchronous state resets
  // are fine here) — reset the view to loading and fetch again.
  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetchUsers();
  }, [fetchUsers]);

  if (!user) return null;

  const closeForm = () => {
    setForm({ kind: 'none' });
    setFormError(null);
  };

  const closeDialog = () => {
    setDialog({ kind: 'none' });
    setFormError(null);
  };

  const openCreate = () => {
    setSuccess(null);
    setFormError(null);
    setForm({ kind: 'create' });
  };

  const openEdit = (target: ManagedUser) => {
    setSuccess(null);
    setFormError(null);
    setForm({ kind: 'edit', user: target });
  };

  const submitCreate = async (input: CreateUserInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await createUser(input);
      closeForm();
      setSuccess('המשתמש נוצר בהצלחה.');
      await load();
    } catch (err) {
      setFormError(userErrorMessage(err, 'יצירת המשתמש נכשלה. נסה שוב.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async (input: UpdateUserInput) => {
    if (form.kind !== 'edit') return;
    setSubmitting(true);
    setFormError(null);
    try {
      await updateUser(form.user.id, input);
      closeForm();
      setSuccess('המשתמש עודכן בהצלחה.');
      await load();
    } catch (err) {
      setFormError(userErrorMessage(err, 'עדכון המשתמש נכשל. נסה שוב.'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmToggle = async () => {
    if (dialog.kind !== 'toggle') return;
    const target = dialog.user;
    setSubmitting(true);
    setActionError(null);
    try {
      await updateUser(target.id, { is_active: !target.is_active });
      closeDialog();
      setSuccess(target.is_active ? 'המשתמש הושבת.' : 'המשתמש הופעל.');
      await load();
    } catch (err) {
      closeDialog();
      setActionError(userErrorMessage(err, 'עדכון סטטוס המשתמש נכשל. נסה שוב.'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (dialog.kind !== 'delete') return;
    setSubmitting(true);
    setActionError(null);
    try {
      await deleteUser(dialog.user.id);
      closeDialog();
      setSuccess('המשתמש נמחק.');
      await load();
    } catch (err) {
      closeDialog();
      setActionError(userErrorMessage(err, 'מחיקת המשתמש נכשלה. נסה שוב.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async (password: string) => {
    if (dialog.kind !== 'reset') return;
    setSubmitting(true);
    setFormError(null);
    try {
      await updateUser(dialog.user.id, { password });
      closeDialog();
      setSuccess('הסיסמה הזמנית אופסה.');
    } catch (err) {
      setFormError(userErrorMessage(err, 'איפוס הסיסמה נכשל. נסה שוב.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ניהול משתמשים</h1>
          <p className="text-sm text-gray-500">הוספה, עריכה והשבתת משתמשי המערכת.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700"
        >
          ➕ משתמש חדש
        </button>
      </div>

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800"
        >
          ✓ {success}
        </div>
      )}

      {actionError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Create / edit form panel. */}
      {form.kind === 'create' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <UserForm
            submitting={submitting}
            error={formError}
            onCreate={submitCreate}
            onUpdate={() => {}}
            onCancel={closeForm}
          />
        </div>
      )}
      {form.kind === 'edit' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <UserForm
            user={form.user}
            isSelf={form.user.id === user.id}
            submitting={submitting}
            error={formError}
            onCreate={() => {}}
            onUpdate={submitEdit}
            onCancel={closeForm}
          />
        </div>
      )}

      {loading && <LoadingSpinner message="טוען משתמשים..." />}

      {loadError && !loading && <ErrorMessage message={loadError} onRetry={load} />}

      {!loading && !loadError && users !== null && users.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          לא נמצאו משתמשים במערכת.
        </div>
      )}

      {!loading && !loadError && users !== null && users.length > 0 && (
        <UsersTable
          users={users}
          currentUserId={user.id}
          onEdit={openEdit}
          onToggleActive={(u) => {
            setSuccess(null);
            setActionError(null);
            setDialog({ kind: 'toggle', user: u });
          }}
          onResetPassword={(u) => {
            setSuccess(null);
            setActionError(null);
            setFormError(null);
            setDialog({ kind: 'reset', user: u });
          }}
          onDelete={(u) => {
            setSuccess(null);
            setActionError(null);
            setDialog({ kind: 'delete', user: u });
          }}
        />
      )}

      {/* Confirmation before deactivating/activating a user. */}
      {dialog.kind === 'toggle' && (
        <ConfirmDialog
          title={dialog.user.is_active ? 'השבתת משתמש' : 'הפעלת משתמש'}
          message={
            dialog.user.is_active
              ? `האם להשבית את המשתמש ${userName(dialog.user)}? לא יוכל להתחבר עד להפעלה מחדש.`
              : `האם להפעיל מחדש את המשתמש ${userName(dialog.user)}?`
          }
          confirmLabel={dialog.user.is_active ? 'השבת' : 'הפעל'}
          onConfirm={confirmToggle}
          onCancel={closeDialog}
        />
      )}

      {/* Confirmation before deleting a user. */}
      {dialog.kind === 'delete' && (
        <ConfirmDialog
          title="מחיקת משתמש"
          message={`האם למחוק לצמיתות את המשתמש ${userName(dialog.user)}? לא ניתן לבטל פעולה זו.`}
          confirmLabel="מחק"
          onConfirm={confirmDelete}
          onCancel={closeDialog}
        />
      )}

      {/* Reset temporary password dialog. */}
      {dialog.kind === 'reset' && (
        <ResetPasswordDialog
          userName={userName(dialog.user)}
          submitting={submitting}
          error={formError}
          onSubmit={submitReset}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
