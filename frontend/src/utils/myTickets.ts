import type { KanbanTicket, User } from '../types';

// Helpers for the personal ticket history page ("הכרטיסים שלי", Stage 10).

// A ticket belongs in the history only once it has been closed/archived from the
// Work Board ("סגור כרטיס"). status === 'Completed' is NOT enough: a Completed
// ticket stays active on the board until it is archived (gains archived_at).
export function isArchived(ticket: KanbanTicket): boolean {
  return ticket.archived_at != null;
}

// Filters a raw ticket list down to the archived tickets the given user should
// see in their personal history. The rules mirror the backend scoping:
//   • Mechanic  — only tickets assigned to them (the API already scopes this; we
//     re-apply it as defence-in-depth so another mechanic's ticket is never shown).
//   • Manager   — tickets they were assigned OR tickets they opened (created_by).
//   • Secretary — tickets they opened (a Secretary is never an assigned mechanic).
// Always excludes non-archived (still-active) tickets first.
export function filterArchivedForUser(tickets: KanbanTicket[], user: User): KanbanTicket[] {
  return tickets.filter((ticket) => {
    if (!isArchived(ticket)) return false;
    switch (user.role) {
      case 'Mechanic':
        return ticket.assigned_mechanic_id === user.id;
      case 'Manager':
        return ticket.assigned_mechanic_id === user.id || ticket.created_by_id === user.id;
      case 'Secretary':
        return ticket.created_by_id === user.id;
      default:
        return false;
    }
  });
}

// Formats an ISO timestamp into a short, deterministic Hebrew-friendly string
// (DD/MM/YYYY HH:mm). Returns an em dash for missing/invalid values so the
// history layout never shows raw nulls.
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
