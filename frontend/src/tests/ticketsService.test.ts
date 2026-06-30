import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KanbanTicket } from '../types';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/apiClient';
import { archiveTicket, getTicket, listTickets, updateTicketStatus } from '../services/tickets';

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

  it('listTickets forwards archived_only + date range for the archive filter', async () => {
    mockedGet.mockResolvedValueOnce({ data: { items: [TICKET], page: 1, limit: 20, total: 1 } });
    await listTickets({ archived_only: true, start_date: '2026-05-01', end_date: '2026-06-02' });
    expect(mockedGet).toHaveBeenCalledWith('/tickets', {
      params: { archived_only: true, start_date: '2026-05-01', end_date: '2026-06-02' },
    });
  });

  it('getTicket reads a single ticket (with parts_used) from GET /tickets/{id}', async () => {
    const detail = { ...TICKET, parts_used: [{ part_id: 1, part_name: 'בלם', part_code: 'BRK', quantity_used: 2 }] };
    mockedGet.mockResolvedValueOnce({ data: detail });
    await expect(getTicket(7)).resolves.toEqual(detail);
    expect(mockedGet).toHaveBeenCalledWith('/tickets/7');
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
