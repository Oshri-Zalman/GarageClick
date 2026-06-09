import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CreateTicketPayload, KanbanTicket, Mechanic, VehicleSearchHit } from '../types';
import { useAuth } from '../hooks/useAuth';
import { searchVehicle } from '../services/vehicles';
import { listMechanics } from '../services/mechanics';
import { createTicket } from '../services/tickets';
import LicensePlateSearch from '../components/LicensePlateSearch';
import ExistingVehicleTicketForm from '../components/ExistingVehicleTicketForm';
import NewCustomerVehicleTicketForm from '../components/NewCustomerVehicleTicketForm';
import ErrorMessage from '../components/ErrorMessage';

// The step the flow is currently on. 'existing'/'new' carry the lookup outcome.
type Stage = 'search' | 'existing' | 'new';

export default function NewTicketPage() {
  const { user } = useAuth();

  const [stage, setStage] = useState<Stage>('search');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [plate, setPlate] = useState('');
  const [vehicle, setVehicle] = useState<VehicleSearchHit | null>(null);

  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<KanbanTicket | null>(null);

  // Manager/Secretary need the assignable-mechanic roster; a Mechanic never
  // picks one (auto-assigned to self), so we skip the fetch for them.
  const needsMechanics = user != null && user.role !== 'Mechanic';
  useEffect(() => {
    if (!needsMechanics) return;
    let active = true;
    listMechanics().then((list) => {
      if (active) setMechanics(list);
    });
    return () => {
      active = false;
    };
  }, [needsMechanics]);

  if (!user) return null;

  const handleSearch = async (licensePlate: string) => {
    setSearching(true);
    setSearchError(null);
    setPlate(licensePlate);
    try {
      const hit = await searchVehicle(licensePlate);
      setVehicle(hit);
      setStage(hit ? 'existing' : 'new');
    } catch {
      setSearchError('שגיאה בחיפוש הרכב. נסה שוב.');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (payload: CreateTicketPayload) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const ticket = await createTicket(payload);
      setCreated(ticket);
    } catch {
      setSubmitError('שגיאה בפתיחת הכרטיס. בדוק את הפרטים ונסה שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setStage('search');
    setVehicle(null);
    setPlate('');
    setSearchError(null);
    setSubmitError(null);
  };

  // Success screen — short summary + a clear path back to the work board.
  if (created) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <div className="mb-2 text-4xl">✅</div>
          <h1 className="mb-2 text-2xl font-bold text-green-800">הכרטיס נפתח בהצלחה</h1>
          <p className="mb-1 text-gray-700">
            מספר כרטיס: <span className="font-bold">{created.ticket_number}</span>
          </p>
          <p className="mb-6 text-gray-600">
            {created.manufacturer} {created.model} · {created.license_plate} · {created.customer_name}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/kanban"
              className="rounded-md bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700"
            >
              חזרה ללוח העבודה
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                resetFlow();
              }}
              className="rounded-md border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
            >
              פתיחת כרטיס נוסף
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-gray-800">פתיחת כרטיס עבודה חדש</h1>
      <p className="mb-6 text-gray-500">התחל בהזנת מספר הרכב לחיפוש במערכת.</p>

      <div className="mb-6">
        <LicensePlateSearch onSearch={handleSearch} loading={searching} />
        {searchError && (
          <div className="mt-4">
            <ErrorMessage message={searchError} />
          </div>
        )}
      </div>

      {stage !== 'search' && (
        <>
          {submitError && (
            <div className="mb-4">
              <ErrorMessage message={submitError} />
            </div>
          )}
          {stage === 'existing' && vehicle && (
            <ExistingVehicleTicketForm
              user={user}
              vehicle={vehicle}
              mechanics={mechanics}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          )}
          {stage === 'new' && (
            <NewCustomerVehicleTicketForm
              user={user}
              licensePlate={plate}
              mechanics={mechanics}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          )}
        </>
      )}
    </div>
  );
}
