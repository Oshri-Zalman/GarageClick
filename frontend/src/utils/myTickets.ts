import type { KanbanTicket, Role, User } from '../types';

// Helpers for the ticket archive page ("ארכיון כרטיסים", Stage 10).

// Which archive a view shows:
//   • 'mine'   — only tickets assigned to the current user ("הארכיון שלי").
//   • 'garage' — every archived ticket the backend returns ("ארכיון המוסך").
export type ArchiveScope = 'mine' | 'garage';

// A ticket belongs in the archive only once it has been closed/archived from the
// Work Board ("סגור כרטיס"). status === 'Completed' is NOT enough: a Completed
// ticket stays active on the board until it is archived (gains archived_at).
export function isArchived(ticket: KanbanTicket): boolean {
  return ticket.archived_at != null;
}

// The archive scopes a role may choose between, in display order. Managers get
// both (rendered as tabs, "הארכיון שלי" first); everyone else has a single,
// fixed scope and therefore no tabs.
export function scopesForRole(role: Role): ArchiveScope[] {
  switch (role) {
    case 'Manager':
      return ['mine', 'garage'];
    case 'Mechanic':
      return ['mine'];
    case 'Secretary':
      return ['garage'];
    default:
      return ['mine'];
  }
}

// The scope a role lands on by default (the first scope it is allowed to see).
export function defaultScopeForRole(role: Role): ArchiveScope {
  return scopesForRole(role)[0];
}

// Filters a raw ticket list down to the archived tickets shown for the given
// scope. Always excludes non-archived (still-active) tickets first.
//   • 'mine'   — tickets assigned to the user (assigned_mechanic_id === id).
//   • 'garage' — every archived ticket (the backend already applies role
//                permissions, e.g. Mechanics are scoped to their own tickets).
// Mechanics are additionally hard-scoped to their own tickets regardless of the
// requested scope, as defence-in-depth (they can never see the garage archive).
export function filterArchive(
  tickets: KanbanTicket[],
  user: User,
  scope: ArchiveScope
): KanbanTicket[] {
  return tickets.filter((ticket) => {
    if (!isArchived(ticket)) return false;
    if (user.role === 'Mechanic') return ticket.assigned_mechanic_id === user.id;
    if (scope === 'mine') return ticket.assigned_mechanic_id === user.id;
    return true;
  });
}

// Hebrew tab/label for each scope.
export const SCOPE_LABELS: Record<ArchiveScope, string> = {
  mine: 'הארכיון שלי',
  garage: 'ארכיון המוסך',
};

// Formats an ISO timestamp into a short, deterministic Hebrew-friendly string
// (DD/MM/YYYY HH:mm). Returns an em dash for missing/invalid values so the
// archive layout never shows raw nulls.
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
