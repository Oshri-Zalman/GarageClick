import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn() },
}));

import apiClient from '../services/apiClient';
import {
  getEmployees,
  getPerformance,
  getTicketsByDay,
  getTicketsSummary,
} from '../services/admin';

const mockedGet = vi.mocked(apiClient.get);

describe('admin service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /admin/tickets/summary (no range)', async () => {
    mockedGet.mockResolvedValueOnce({ data: { total_pending: 1 } });
    await getTicketsSummary();
    expect(mockedGet).toHaveBeenCalledWith('/admin/tickets/summary', { params: {} });
  });

  it('GET /admin/tickets/summary forwards the date range', async () => {
    mockedGet.mockResolvedValueOnce({ data: { total_pending: 1 } });
    await getTicketsSummary({ start_date: '2026-05-01', end_date: '2026-06-02' });
    expect(mockedGet).toHaveBeenCalledWith('/admin/tickets/summary', {
      params: { start_date: '2026-05-01', end_date: '2026-06-02' },
    });
  });

  it('GET /admin/employees', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });
    await getEmployees();
    expect(mockedGet).toHaveBeenCalledWith('/admin/employees');
  });

  it('GET /admin/tickets/by-day forwards the date range', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });
    await getTicketsByDay({ start_date: '2026-05-01', end_date: '2026-06-02' });
    expect(mockedGet).toHaveBeenCalledWith('/admin/tickets/by-day', {
      params: { start_date: '2026-05-01', end_date: '2026-06-02' },
    });
  });

  it('GET /admin/reports/performance forwards the mechanic_id', async () => {
    mockedGet.mockResolvedValueOnce({ data: { mechanic_id: 5 } });
    await getPerformance(5);
    expect(mockedGet).toHaveBeenCalledWith('/admin/reports/performance', {
      params: { mechanic_id: 5 },
    });
  });

  it('GET /admin/reports/performance forwards the mechanic_id + date range', async () => {
    mockedGet.mockResolvedValueOnce({ data: { mechanic_id: 5 } });
    await getPerformance(5, { start_date: '2026-05-01', end_date: '2026-06-02' });
    expect(mockedGet).toHaveBeenCalledWith('/admin/reports/performance', {
      params: { mechanic_id: 5, start_date: '2026-05-01', end_date: '2026-06-02' },
    });
  });
});
