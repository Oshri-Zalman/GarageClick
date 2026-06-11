import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn() },
}));

import apiClient from '../services/apiClient';
import { listMechanics } from '../services/mechanics';

const mockedGet = vi.mocked(apiClient.get);

describe('listMechanics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the real GET /api/mechanics endpoint (not the admin endpoint)', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });
    await listMechanics();
    expect(mockedGet).toHaveBeenCalledWith('/mechanics');
  });

  it('maps the backend rows (full_name → name) for the dropdown', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        { id: 1, username: 'uri', full_name: 'אורי מנהל', role: 'Manager' },
        { id: 5, username: 'david', full_name: 'דוד כהן', role: 'Mechanic' },
      ],
    });

    const result = await listMechanics();

    expect(result).toEqual([
      { id: 1, name: 'אורי מנהל', role: 'Manager' },
      { id: 5, name: 'דוד כהן', role: 'Mechanic' },
    ]);
  });

  it('falls back to the username when full_name is missing', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [{ id: 7, username: 'avi', full_name: null, role: 'Mechanic' }],
    });

    const result = await listMechanics();

    expect(result).toEqual([{ id: 7, name: 'avi', role: 'Mechanic' }]);
  });

  it('propagates errors instead of returning fabricated mechanic ids', async () => {
    mockedGet.mockRejectedValueOnce({ response: { status: 403 } });
    await expect(listMechanics()).rejects.toBeTruthy();
  });
});
