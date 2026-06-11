import { useState } from 'react';
import { AxiosError } from 'axios';
import { useAuth } from '../hooks/useAuth';
import { canManageCustomers } from '../config/access';
import {
  type CustomerSearchType,
  createCustomer,
  getCustomer,
  searchCustomersByPhone,
  searchCustomersByPlate,
  updateCustomer,
} from '../services/customers';
import { createVehicle, updateVehicle } from '../services/vehicles';
import type {
  CustomerDetail,
  CustomerInput,
  CustomerSummary,
  CustomerVehicle,
  VehicleInput,
} from '../types';
import CustomerSearch from '../components/CustomerSearch';
import CustomerCard from '../components/CustomerCard';
import VehicleList from '../components/VehicleList';
import CustomerForm from '../components/CustomerForm';
import VehicleForm from '../components/VehicleForm';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

// Which create/edit form (if any) is currently open.
type FormState =
  | { kind: 'none' }
  | { kind: 'customer-create' }
  | { kind: 'customer-edit' }
  | { kind: 'vehicle-create' }
  | { kind: 'vehicle-edit'; vehicle: CustomerVehicle };

// Pull the backend's Hebrew/English detail message off an Axios error, falling
// back to a generic Hebrew message.
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

// Stage 6 — dedicated Customers & Vehicles management screen (FR-1). Search by
// phone or license plate, view a customer with their vehicles, and create/edit
// customers and vehicles per role permissions. Access to this page is already
// restricted to Manager/Secretary by the route guard (config/access).
export default function CustomersPage() {
  const { user } = useAuth();

  const [results, setResults] = useState<CustomerSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearch, setLastSearch] = useState<{ type: CustomerSearchType; query: string } | null>(
    null
  );

  const [selected, setSelected] = useState<CustomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [form, setForm] = useState<FormState>({ kind: 'none' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) return null;
  const canManage = canManageCustomers(user.role);

  const closeForm = () => {
    setForm({ kind: 'none' });
    setFormError(null);
  };

  const loadDetail = async (id: number): Promise<CustomerDetail | null> => {
    setLoadingDetail(true);
    try {
      const detail = await getCustomer(id);
      setSelected(detail);
      return detail;
    } catch (err) {
      setSearchError(errorMessage(err, 'שגיאה בטעינת פרטי הלקוח. נסה שוב.'));
      return null;
    } finally {
      setLoadingDetail(false);
    }
  };

  const runSearch = async (type: CustomerSearchType, query: string) => {
    setSearching(true);
    setSearchError(null);
    setSuccess(null);
    setSelected(null);
    setResults(null);
    closeForm();
    setLastSearch({ type, query });
    try {
      const summaries: CustomerSummary[] =
        type === 'license_plate'
          ? await searchCustomersByPlate(query)
          : await searchCustomersByPhone(query);
      setResults(summaries);
      // A single hit goes straight to its detail view (FR-1 quick search).
      if (summaries.length === 1) {
        await loadDetail(summaries[0].id);
      }
    } catch (err) {
      setSearchError(errorMessage(err, 'שגיאה בחיפוש. נסה שוב.'));
    } finally {
      setSearching(false);
    }
  };

  const retrySearch = () => {
    if (lastSearch) runSearch(lastSearch.type, lastSearch.query);
  };

  const openNewCustomer = () => {
    setSuccess(null);
    setSelected(null);
    setResults(null);
    setForm({ kind: 'customer-create' });
    setFormError(null);
  };

  const submitCustomer = async (input: CustomerInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (form.kind === 'customer-edit' && selected) {
        await updateCustomer(selected.id, input);
        closeForm();
        await loadDetail(selected.id);
        setSuccess('הלקוח עודכן בהצלחה.');
      } else {
        const created = await createCustomer(input);
        closeForm();
        await loadDetail(created.id);
        setSuccess('הלקוח נוצר בהצלחה.');
      }
    } catch (err) {
      setFormError(errorMessage(err, 'שמירת הלקוח נכשלה. נסה שוב.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitVehicle = async (input: VehicleInput) => {
    if (!selected) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (form.kind === 'vehicle-edit') {
        await updateVehicle(form.vehicle.id, input);
        setSuccess('הרכב עודכן בהצלחה.');
      } else {
        await createVehicle(selected.id, input);
        setSuccess('הרכב נוסף בהצלחה.');
      }
      closeForm();
      await loadDetail(selected.id);
    } catch (err) {
      setFormError(errorMessage(err, 'שמירת הרכב נכשלה. נסה שוב.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">לקוחות ורכבים</h1>
        {canManage && (
          <button
            type="button"
            onClick={openNewCustomer}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700"
          >
            ➕ לקוח חדש
          </button>
        )}
      </div>

      <CustomerSearch searching={searching} onSearch={runSearch} />

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800"
        >
          ✓ {success}
        </div>
      )}

      {searching && <LoadingSpinner message="מחפש לקוחות..." />}

      {searchError && !searching && <ErrorMessage message={searchError} onRetry={retrySearch} />}

      {/* Empty search result state. */}
      {!searching && !searchError && results !== null && results.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          לא נמצאו תוצאות עבור החיפוש.
        </div>
      )}

      {/* More than one match — let the user pick which customer to open. */}
      {!searching && results !== null && results.length > 1 && (
        <ul aria-label="תוצאות חיפוש" className="flex flex-col gap-2">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => loadDetail(c.id)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-right transition-colors hover:bg-amber-50"
              >
                <span className="font-semibold text-gray-800">{c.full_name}</span>
                <span dir="ltr" className="text-sm text-gray-600">
                  {c.phone_number}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {loadingDetail && <LoadingSpinner message="טוען פרטי לקוח..." />}

      {/* Create / edit forms render in a panel of their own. */}
      {form.kind === 'customer-create' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <CustomerForm
            submitting={submitting}
            error={formError}
            onSubmit={submitCustomer}
            onCancel={closeForm}
          />
        </div>
      )}

      {selected && !loadingDetail && (
        <div className="flex flex-col gap-4">
          {form.kind === 'customer-edit' ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <CustomerForm
                customer={selected}
                submitting={submitting}
                error={formError}
                onSubmit={submitCustomer}
                onCancel={closeForm}
              />
            </div>
          ) : (
            <CustomerCard
              customer={selected}
              canManage={canManage}
              onEdit={() => {
                setSuccess(null);
                setForm({ kind: 'customer-edit' });
                setFormError(null);
              }}
            />
          )}

          {(form.kind === 'vehicle-create' || form.kind === 'vehicle-edit') && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <VehicleForm
                vehicle={form.kind === 'vehicle-edit' ? form.vehicle : undefined}
                submitting={submitting}
                error={formError}
                onSubmit={submitVehicle}
                onCancel={closeForm}
              />
            </div>
          )}

          {form.kind !== 'vehicle-create' && form.kind !== 'vehicle-edit' && (
            <VehicleList
              vehicles={selected.vehicles}
              canManage={canManage}
              onAdd={() => {
                setSuccess(null);
                setForm({ kind: 'vehicle-create' });
                setFormError(null);
              }}
              onEdit={(vehicle) => {
                setSuccess(null);
                setForm({ kind: 'vehicle-edit', vehicle });
                setFormError(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
