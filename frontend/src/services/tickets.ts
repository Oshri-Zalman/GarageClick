import apiClient from './apiClient';
import type {
  CreateTicketPayload,
  KanbanTicket,
  Paginated,
  TicketStatus,
} from '../types';

interface ListParams {
  status?: TicketStatus;
  mechanic_id?: number;
  // When true, the backend returns archived (closed) tickets alongside active
  // ones (GET /api/tickets?include_archived=true). Omitted by default so the
  // Work Board keeps fetching active tickets only. Used by the ticket archive
  // ("ארכיון כרטיסים").
  include_archived?: boolean;
}

// POST /api/tickets — opens a new work ticket. Accepts either the existing
// vehicle payload (vehicle_id) or the new customer+vehicle payload
// (license_plate + new_customer + new_vehicle). Returns the created ticket
// joined with its vehicle/customer/mechanic, ready for the Kanban board.
export async function createTicket(payload: CreateTicketPayload): Promise<KanbanTicket> {
  const { data } = await apiClient.post<KanbanTicket>('/tickets', payload);
  return data;
}

// GET /api/tickets — returns the flat list of tickets. The backend already
// scopes Mechanics to their own tickets and applies any status/mechanic filter.
// By default archived (closed) tickets are excluded; pass include_archived=true
// to fetch the ticket archive / history ("ארכיון כרטיסים").
export async function listTickets(params: ListParams = {}): Promise<KanbanTicket[]> {
  const { data } = await apiClient.get<Paginated<KanbanTicket>>('/tickets', { params });
  return data.items;
}

// PATCH /api/tickets/{id}/status — advances a ticket through the state machine.
// `confirmation` must be true when completing a ticket (FR-3 / NFR-3).
export async function updateTicketStatus(
  id: number,
  newStatus: TicketStatus,
  confirmation = false
): Promise<KanbanTicket> {
  const { data } = await apiClient.patch<KanbanTicket>(`/tickets/${id}/status`, {
    new_status: newStatus,
    confirmation,
  });
  return data;
}

// POST /api/tickets/{id}/archive — close/archive a COMPLETED ticket (Stage 8
// backend follow-up). The ticket is kept in the DB and history (it gains an
// `archived_at` timestamp) but leaves the active board. The backend returns 409
// if the ticket is not Completed, and enforces the same permissions as a status
// change (Manager/Secretary, or the assigned Mechanic).
export async function archiveTicket(id: number): Promise<KanbanTicket> {
  const { data } = await apiClient.post<KanbanTicket>(`/tickets/${id}/archive`);
  return data;
}
