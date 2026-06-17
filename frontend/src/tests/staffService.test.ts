import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TicketsSummary } from '../types';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn() },
}));

import apiClient from '../services/apiClient';
import { getStaffTicketsSummary } from '../services/staff';

const mockedGet = vi.mocked(apiClient.get);

const SUMMARY: TicketsSummary = {
  total_pending: 3,
  total_in_progress: 2,
  total_completed: 10,
  avg_completion_minutes: 145,
};

describe('staff service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the operational summary from GET /staff/tickets/summary', async () => {
    mockedGet.mockResolvedValueOnce({ data: SUMMARY });
    await expect(getStaffTicketsSummary()).resolves.toEqual(SUMMARY);
    expect(mockedGet).toHaveBeenCalledWith('/staff/tickets/summary');
  });

  it('propagates errors so the dashboard can show a Hebrew error + retry', async () => {
    mockedGet.mockRejectedValueOnce(new Error('500'));
    await expect(getStaffTicketsSummary()).rejects.toBeTruthy();
  });
});
