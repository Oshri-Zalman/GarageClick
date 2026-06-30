import type { TicketStatus } from '../types';

// Single source of truth for the ticket lifecycle as the frontend presents it.
// The legal transitions mirror the backend state machine (workflow.py): the UI
// can never offer a move the server would reject.

// Fixed display order of the three Kanban columns.
export const STATUS_ORDER: TicketStatus[] = ['Pending', 'In Progress', 'Completed'];

// Hebrew labels shown in column headers and status badges.
export const STATUS_LABELS: Record<TicketStatus, string> = {
  Pending: 'ממתין לטיפול',
  'In Progress': 'בטיפול',
  Completed: 'הושלם',
};

// Status → badge colors. Product palette (consistent across every status
// badge/card in the frontend): ממתין לטיפול / Pending → red,
// בטיפול / In Progress → yellow, הושלם / Completed → green. This is presentation
// only — the status KEYS ('Pending'/'In Progress'/'Completed') never change.
export const STATUS_BADGE_STYLES: Record<TicketStatus, string> = {
  Pending: 'bg-red-100 text-red-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  Completed: 'bg-green-100 text-green-800',
};

// Accent text color for the big status number cards (same palette as the badges).
export const STATUS_ACCENT_STYLES: Record<TicketStatus, string> = {
  Pending: 'text-red-600',
  'In Progress': 'text-yellow-600',
  Completed: 'text-green-600',
};

// Active filter-button styling per status: the badge color plus a matching
// border so the active filter reads as "the same thing" as its column.
export const STATUS_FILTER_ACTIVE_STYLES: Record<TicketStatus, string> = {
  Pending: 'bg-red-100 text-red-800 border border-red-400',
  'In Progress': 'bg-yellow-100 text-yellow-800 border border-yellow-400',
  Completed: 'bg-green-100 text-green-800 border border-green-400',
};

// The status a ticket advances to from a given column, or null if terminal.
export const NEXT_STATUS: Record<TicketStatus, TicketStatus | null> = {
  Pending: 'In Progress',
  'In Progress': 'Completed',
  Completed: null,
};

// Hebrew label of the action button shown on a card, or null when there is no
// action (Completed cards have no buttons).
export const ACTION_LABELS: Record<TicketStatus, string | null> = {
  Pending: 'התחל טיפול',
  'In Progress': 'סיים טיפול',
  Completed: null,
};
