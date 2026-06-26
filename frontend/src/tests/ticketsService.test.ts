import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KanbanTicket } from '../types';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/apiClient';
import { archiveTicket, listTickets, updateTicketStatus } from '../services/tickets';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPatch = vi.mocked(apiClient.patch);

const TICKET = { id: 7, ticket_number: 'TKT-00007', status: 'Completed' } as KanbanTicket;

describe('tickets service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listTickets returns the items array from the paginated envelope', async () => {
    mockedGet.mockResolvedValueOnce({ data: { items: [TICKET], page: 1, limit: 20, total: 1 } });
    await expect(listTickets()).resolves.toEqual([TICKET]);
    expect(mockedGet).toHaveBeenCalledWith('/tickets', { params: {} });
  });

  it('listTickets forwards archived_only=true for the ticket archive', async () => {
    mockedGet.mockResolvedValueOnce({ data: { items: [TICKET], page: 1, limit: 20, total: 1 } });
    await listTickets({ archived_only: true });
    expect(mockedGet).toHaveBeenCalledWith('/tickets', { params: { archived_only: true } });
  });

  it('updateTicketStatus PATCHes the new status + confirmation flag', async () => {
    mockedPatch.mockResolvedValueOnce({ data: TICKET });
    await updateTicketStatus(7, 'Completed', true);
    expect(mockedPatch).toHaveBeenCalledWith('/tickets/7/status', {
      new_status: 'Completed',
      confirmation: true,
    });
  });

  it('archiveTicket POSTs to /tickets/{id}/archive', async () => {
    mockedPost.mockResolvedValueOnce({ data: { ...TICKET, archived_at: '2026-06-18T10:00:00Z' } });
    const result = await archiveTicket(7);
    expect(mockedPost).toHaveBeenCalledWith('/tickets/7/archive');
    expect(result.archived_at).toBe('2026-06-18T10:00:00Z');
  });
});
