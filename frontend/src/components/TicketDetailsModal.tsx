import { useCallback, useEffect, useState } from 'react';
import type { TicketDetail } from '../types';
import { getTicket } from '../services/tickets';
import { formatDateTime } from '../utils/myTickets';
import StatusBadge from './StatusBadge';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  ticketId: number;
  onClose: () => void;
}

// A small, read-only details modal opened by double-clicking a Work Board card.
// It fetches the full ticket (GET /api/tickets/{id}), including the parts it used,
// and shows them at a glance. Deliberately lighter than the "new ticket" modal:
// no editing, no status change, no archiving — just a quick look. Loading / Hebrew
// error (with retry + close) / ready states are all handled here.
export default function TicketDetailsModal({ ticketId, onClose }: Props) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDetails = useCallback(() => {
    getTicket(ticketId)
      .then((data) => {
        setTicket(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchDetails();
  }, [fetchDetails]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
      dir="rtl"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-details-title"
        onClick={(e) => e.stopPropagation()}
        className="my-auto w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="ticket-details-title" className="text-lg font-bold text-gray-800">
            פרטי כרטיס
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="rounded-md px-2 py-1 text-xl leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <LoadingSpinner message="טוען פרטי כרטיס..." />
        ) : error ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm font-medium text-red-600">
              שגיאה בטעינת פרטי הכרטיס. נסה שוב.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={retry}
                className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
              >
                נסה שוב
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                סגור
              </button>
            </div>
          </div>
        ) : ticket ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-bold text-gray-900">{ticket.license_plate}</span>
              <StatusBadge status={ticket.status} />
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm text-gray-600 sm:grid-cols-2">
              <Detail label="מספר כרטיס" value={ticket.ticket_number} />
              <Detail label="לקוח" value={ticket.customer_name} />
              <Detail label="מכונאי מטפל" value={ticket.mechanic_name ?? 'לא משויך'} />
            </dl>

            {/* Dates: label on its own line with the date + time together below
                it, so the timestamp reads cleanly instead of being squeezed
                inline. */}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-gray-600 sm:grid-cols-2">
              <DateDetail label="נפתח בתאריך" value={formatDateTime(ticket.created_at)} />
              {ticket.completed_at && (
                <DateDetail label="הושלם בתאריך" value={formatDateTime(ticket.completed_at)} />
              )}
              {ticket.archived_at && (
                <DateDetail label="נסגר בתאריך" value={formatDateTime(ticket.archived_at)} />
              )}
            </dl>

            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-700">תיאור התקלה</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-600">{ticket.description}</p>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-700">חלפים בשימוש</h3>
              {ticket.parts_used.length === 0 ? (
                <p className="text-sm text-gray-500">ללא חלפים</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm text-gray-600">
                  {ticket.parts_used.map((part) => (
                    <li key={part.part_id} className="flex justify-between gap-2">
                      <span>
                        {part.part_name}{' '}
                        <span className="text-gray-400">({part.part_code})</span>
                      </span>
                      <span className="font-semibold text-gray-800">× {part.quantity_used}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="font-semibold text-gray-600">{label}:</dt>
      <dd className="text-gray-700">{value}</dd>
    </div>
  );
}

// A date field: the label sits on its own line with the date + time (a single
// string, kept together) on the line below. RTL is inherited from the modal.
function DateDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="font-semibold text-gray-600">{label}</dt>
      <dd className="whitespace-nowrap text-gray-700">{value}</dd>
    </div>
  );
}
