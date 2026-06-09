import { useEffect } from 'react';
import type { KanbanTicket, User } from '../types';
import TicketCreationFlow from './TicketCreationFlow';

interface Props {
  user: User;
  // Closes the modal. No ticket is created on close — creation only happens on an
  // explicit form submit inside the flow.
  onClose: () => void;
  // Forwarded to the flow so the Work Board can refresh after a creation.
  onCreated?: (ticket: KanbanTicket) => void;
}

// Hosts the Stage 4 ticket-creation flow in a dialog above the Work Board. The
// board stays mounted behind the semi-transparent backdrop.
export default function NewTicketModal({ user, onClose, onCreated }: Props) {
  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      dir="rtl"
      // Backdrop click closes the modal; clicks inside the panel are stopped below.
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-ticket-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="my-auto w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="new-ticket-modal-title" className="text-2xl font-bold text-gray-800">
            פתיחת כרטיס עבודה חדש
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="rounded-md px-2 py-1 text-2xl leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <TicketCreationFlow user={user} onCreated={onCreated} onClose={onClose} />
      </div>
    </div>
  );
}
