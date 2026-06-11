import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CreateTicketPayload, KanbanTicket, Mechanic, User, VehicleSearchHit } from '../types';
import { searchVehicle } from '../services/vehicles';
import { listMechanics } from '../services/mechanics';
import { createTicket } from '../services/tickets';
import LicensePlateSearch from './LicensePlateSearch';
import ExistingVehicleTicketForm from './ExistingVehicleTicketForm';
import NewCustomerVehicleTicketForm from './NewCustomerVehicleTicketForm';
import ErrorMessage from './ErrorMessage';

// The step the flow is currently on. 'existing'/'new' carry the lookup outcome.
type Stage = 'search' | 'existing' | 'new';

interface Props {
  user: User;
  // Called after a ticket is successfully created — e.g. so the Work Board can
  // refresh and show the new ticket.
  onCreated?: (ticket: KanbanTicket) => void;
  // When provided the flow is hosted in a modal: the success "back to board"
  // action becomes a button that calls this instead of linking to /kanban.
  onClose?: () => void;
}

// The shared Stage 4 ticket-creation flow: license-plate search, then either the
// existing-vehicle form or the new customer/vehicle form, plus the success/error
// states. Hosted both by the standalone NewTicketPage (/tickets/new) and by the
// Work Board modal, so the form logic lives in exactly one place.
export default function TicketCreationFlow({ user, onCreated, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('search');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [plate, setPlate] = useState('');
  const [vehicle, setVehicle] = useState<VehicleSearchHit | null>(null);

  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [mechanicsError, setMechanicsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<KanbanTicket | null>(null);

  // Manager/Secretary need the assignable-mechanic roster from the real
  // GET /api/mechanics endpoint; a Mechanic never picks one (auto-assigned to
  // self), so we skip the fetch for them. On failure we surface a clear Hebrew
  // error and keep an empty dropdown — required-field validation then blocks
  // submission, so we never assign a fabricated mechanic id.
  const needsMechanics = user.role !== 'Mechanic';
  useEffect(() => {
    if (!needsMechanics) return;
    let active = true;
    listMechanics()
      .then((list) => {
        if (active) {
          setMechanics(list);
          setMechanicsError(null);
        }
      })
      .catch(() => {
        if (active) {
          setMechanics([]);
          setMechanicsError('שגיאה בטעינת רשימת העובדים המטפלים. נסה לרענן את הדף.');
        }
      });
    return () => {
      active = false;
    };
  }, [needsMechanics]);

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
      onCreated?.(ticket);
    } catch {
      setSubmitError('שגיאה בפתיחת הכרטיס. בדוק את הפרטים ונסה שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setCreated(null);
    setStage('search');
    setVehicle(null);
    setPlate('');
    setSearchError(null);
    setSubmitError(null);
  };

  // Success state — short summary + a clear path back to the work board.
  if (created) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mb-2 text-4xl">✅</div>
        <h2 className="mb-2 text-2xl font-bold text-green-800">הכרטיס נפתח בהצלחה</h2>
        <p className="mb-1 text-gray-700">
          מספר כרטיס: <span className="font-bold">{created.ticket_number}</span>
        </p>
        <p className="mb-6 text-gray-600">
          {created.manufacturer} {created.model} · {created.license_plate} · {created.customer_name}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700"
            >
              חזרה ללוח העבודה
            </button>
          ) : (
            <Link
              to="/kanban"
              className="rounded-md bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700"
            >
              חזרה ללוח העבודה
            </Link>
          )}
          <button
            type="button"
            onClick={resetFlow}
            className="rounded-md border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
          >
            פתיחת כרטיס נוסף
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-gray-500">התחל בהזנת מספר הרכב לחיפוש במערכת.</p>

      <div className="mb-4">
        <LicensePlateSearch onSearch={handleSearch} loading={searching} />
        {searchError && (
          <div className="mt-4">
            <ErrorMessage message={searchError} />
          </div>
        )}
      </div>

      {stage !== 'search' && (
        <>
          {mechanicsError && (
            <div className="mb-4">
              <ErrorMessage message={mechanicsError} />
            </div>
          )}
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
