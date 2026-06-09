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
