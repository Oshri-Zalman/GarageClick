import type { TicketStatus } from '../types';

// Single source of truth for the ticket lifecycle as the frontend presents it.
// The legal transitions mirror the backend state machine (workflow.py): the UI
// can never offer a move the server would reject.

// Fixed display order of the three Kanban columns.
export const STATUS_ORDER: TicketStatus[] = ['Pending', 'In Progress', 'Completed'];

// Hebrew labels shown in column headers and status badges.
export const STATUS_LABELS: Record<TicketStatus, string> = {
  Pending: 'ממתין',
  'In Progress': 'בטיפול',
  Completed: 'הושלם',
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
  Pending: 'קבל',
  'In Progress': 'סיים טיפול',
  Completed: null,
};
