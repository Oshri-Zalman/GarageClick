import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn() },
}));

import apiClient from '../services/apiClient';
import { getCompatibleParts } from '../services/parts';

const mockedGet = vi.mocked(apiClient.get);

describe('getCompatibleParts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls GET /parts/compatible with manufacturer/model/year query params', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });
    await getCompatibleParts('Volkswagen', 'Golf', 2018);
    expect(mockedGet).toHaveBeenCalledWith('/parts/compatible', {
      params: { manufacturer: 'Volkswagen', model: 'Golf', year: 2018 },
    });
  });

  it('returns the compatible parts list from the response', async () => {
    const rows = [
      {
        id: 1,
        part_name: 'בלמים דיסק קדמי',
        part_code: 'BRK001',
        manufacturer: 'Volkswagen',
        model: 'Golf',
        year_start: 2015,
        quantity_current: 3,
        available: true,
      },
    ];
    mockedGet.mockResolvedValueOnce({ data: rows });
    await expect(getCompatibleParts('Volkswagen', 'Golf', 2018)).resolves.toEqual(rows);
  });

  it('propagates errors so the caller can show a Hebrew error + retry', async () => {
    mockedGet.mockRejectedValueOnce(new Error('network'));
    await expect(getCompatibleParts('Volkswagen', 'Golf', 2018)).rejects.toBeTruthy();
  });
});
