import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { canManageParts } from '../config/access';
import {
  createPart,
  getInventory,
  updatePart,
  updatePartQuantity,
  type InventoryQuery,
} from '../services/parts';
import type { Part, PartInput } from '../types';
import { apiErrorMessage } from '../utils/apiErrors';
import PartsInventoryTable from '../components/PartsInventoryTable';
import PartsInventoryFilters from '../components/PartsInventoryFilters';
import { EMPTY_FILTERS, type PartFilters } from '../components/partsFilters';
import PartForm from '../components/PartForm';
import QuantityUpdateControl from '../components/QuantityUpdateControl';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

// Which create/edit panel (if any) is currently open.
type FormState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; part: Part }
  | { kind: 'quantity'; part: Part };

// Stage 7 — dedicated parts inventory management screen (FR-7). List, search and
// create/edit parts plus quantity updates. Access is restricted to
// Manager/Secretary by the route guard (config/access); mechanics never reach it.
export default function PartsPage() {
  const { user } = useAuth();

  const [parts, setParts] = useState<Part[] | null>(null);
  // Starts true: the inventory is fetched on mount, so the first paint is the
  // loading state.
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<PartFilters>(EMPTY_FILTERS);

  const [form, setForm] = useState<FormState>({ kind: 'none' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // The active server-side query, derived from the filter fields. Blank fields
  // are dropped so they aren't sent. manufacturer/model are exact matches on the
  // backend; part_name/part_code are partial (Stage 7 server-side filtering).
  const query = useMemo<InventoryQuery>(() => {
    const q: InventoryQuery = {};
    if (filters.manufacturer.trim()) q.manufacturer = filters.manufacturer.trim();
    if (filters.model.trim()) q.model = filters.model.trim();
    if (filters.partName.trim()) q.part_name = filters.partName.trim();
    if (filters.partCode.trim()) q.part_code = filters.partCode.trim();
    return q;
  }, [filters]);

  const hasFilters = Object.keys(query).length > 0;

  // Fetches one page of the (server-filtered) inventory and folds the items into
  // state. State is only ever touched asynchronously (inside the promise
  // callbacks), so this is safe to call from an effect without triggering
  // cascading synchronous renders.
  const fetchParts = useCallback(
    () =>
      getInventory(query)
        .then((res) => setParts(res.items))
        .catch((err) => setLoadError(apiErrorMessage(err, 'שגיאה בטעינת המלאי. נסה שוב.')))
        .finally(() => setLoading(false)),
    [query]
  );

  // Refetch whenever the filter-derived query changes (the backend does the
  // filtering now, so each filter change is a new request).
  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  // Reload handler (runs in an event/async context, so synchronous state resets
  // are fine here) — reset the view to loading and fetch again.
  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetchParts();
  }, [fetchParts]);

  const filtered = parts ?? [];

  if (!user) return null;
  const canManage = canManageParts(user.role);

  const closeForm = () => {
    setForm({ kind: 'none' });
    setFormError(null);
  };

  const openCreate = () => {
    setSuccess(null);
    setFormError(null);
    setForm({ kind: 'create' });
  };

  const submitPart = async (input: PartInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (form.kind === 'edit') {
        await updatePart(form.part.id, input);
        setSuccess('החלף עודכן בהצלחה.');
      } else {
        await createPart(input);
        setSuccess('החלף נוצר בהצלחה.');
      }
      closeForm();
      await reload();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'שמירת החלף נכשלה. נסה שוב.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitQuantity = async (quantity: number) => {
    if (form.kind !== 'quantity') return;
    setSubmitting(true);
    setFormError(null);
    try {
      await updatePartQuantity(form.part.id, quantity);
      setSuccess('הכמות עודכנה בהצלחה.');
      closeForm();
      await reload();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'עדכון הכמות נכשל. נסה שוב.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isEmpty = parts !== null && parts.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">מלאי חלקים</h1>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700"
          >
            ➕ חלף חדש
          </button>
        )}
      </div>

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800"
        >
          ✓ {success}
        </div>
      )}

      {/* Create / edit / quantity panels. */}
      {form.kind === 'create' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <PartForm
            submitting={submitting}
            error={formError}
            onSubmit={submitPart}
            onCancel={closeForm}
          />
        </div>
      )}
      {form.kind === 'edit' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <PartForm
            part={form.part}
            submitting={submitting}
            error={formError}
            onSubmit={submitPart}
            onCancel={closeForm}
          />
        </div>
      )}
      {form.kind === 'quantity' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <QuantityUpdateControl
            part={form.part}
            submitting={submitting}
            error={formError}
            onSubmit={submitQuantity}
            onCancel={closeForm}
          />
        </div>
      )}

      <PartsInventoryFilters filters={filters} onChange={setFilters} />

      {loading && <LoadingSpinner message="טוען מלאי חלקים..." />}

      {loadError && !loading && <ErrorMessage message={loadError} onRetry={reload} />}

      {/* No results. With an active filter this means the server returned no
          match; with no filter it means the inventory is empty. */}
      {!loading && !loadError && isEmpty && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          {hasFilters ? 'לא נמצאו חלפים התואמים לסינון.' : 'אין חלפים במלאי. הוסף חלף חדש כדי להתחיל.'}
        </div>
      )}

      {!loading && !loadError && filtered.length > 0 && (
        <PartsInventoryTable
          parts={filtered}
          canManage={canManage}
          onEdit={(part) => {
            setSuccess(null);
            setFormError(null);
            setForm({ kind: 'edit', part });
          }}
          onUpdateQuantity={(part) => {
            setSuccess(null);
            setFormError(null);
            setForm({ kind: 'quantity', part });
          }}
        />
      )}
    </div>
  );
}
