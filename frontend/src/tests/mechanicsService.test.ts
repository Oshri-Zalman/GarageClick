import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn() },
}));

import apiClient from '../services/apiClient';
import { listMechanics, MOCK_MECHANICS } from '../services/mechanics';

const mockedGet = vi.mocked(apiClient.get);

describe('listMechanics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps assignable employees (Mechanic/Manager) from the real endpoint', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        { id: 1, name: 'אורי', role: 'Manager' },
        { id: 2, name: 'שרה', role: 'Secretary' }, // filtered out — not assignable
        { id: 5, name: 'דוד', role: 'Mechanic' },
      ],
    });

    const result = await listMechanics();

    expect(mockedGet).toHaveBeenCalledWith('/admin/employees');
    expect(result).toEqual([
      { id: 1, name: 'אורי', role: 'Manager' },
      { id: 5, name: 'דוד', role: 'Mechanic' },
    ]);
  });

  it('falls back to MOCK_MECHANICS when the endpoint is forbidden/fails', async () => {
    mockedGet.mockRejectedValueOnce({ response: { status: 403 } });
    await expect(listMechanics()).resolves.toEqual(MOCK_MECHANICS);
  });

  it('falls back to MOCK_MECHANICS when no assignable employees are returned', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [{ id: 2, name: 'שרה', role: 'Secretary' }],
    });
    await expect(listMechanics()).resolves.toEqual(MOCK_MECHANICS);
  });
});
