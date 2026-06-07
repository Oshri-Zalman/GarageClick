import apiClient from './apiClient';
import type { KanbanTicket, Paginated, TicketStatus } from '../types';

interface ListParams {
  status?: TicketStatus;
  mechanic_id?: number;
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
