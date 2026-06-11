import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import apiClient from '../services/apiClient';
import {
  createPart,
  getAllParts,
  getCompatibleParts,
  getInventory,
  updatePart,
  updatePartQuantity,
} from '../services/parts';
import type { Part, PartInput } from '../types';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPut = vi.mocked(apiClient.put);

const PART: Part = {
  id: 1,
  part_name: 'בלמים דיסק קדמי',
  part_code: 'BRK001',
  manufacturer: 'Volkswagen',
  model: 'Golf',
  year_start: 2015,
  quantity_current: 3,
};

const PART_INPUT: PartInput = {
  part_name: 'בלמים דיסק קדמי',
  part_code: 'BRK001',
  manufacturer: 'Volkswagen',
  model: 'Golf',
  year_start: 2015,
  quantity_current: 3,
};

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

describe('inventory services', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getInventory requests one page of the inventory envelope', async () => {
    const envelope = { items: [PART], page: 1, limit: 200, total: 1 };
    mockedGet.mockResolvedValueOnce({ data: envelope });
    await expect(getInventory(1, 200)).resolves.toEqual(envelope);
    expect(mockedGet).toHaveBeenCalledWith('/parts/inventory', { params: { page: 1, limit: 200 } });
  });

  it('getAllParts pages through the inventory until total is reached', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { items: [PART], page: 1, limit: 200, total: 2 } })
      .mockResolvedValueOnce({
        data: { items: [{ ...PART, id: 2 }], page: 2, limit: 200, total: 2 },
      });
    const all = await getAllParts();
    expect(all).toHaveLength(2);
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it('createPart POSTs the new part body', async () => {
    mockedPost.mockResolvedValueOnce({ data: PART });
    await expect(createPart(PART_INPUT)).resolves.toEqual(PART);
    expect(mockedPost).toHaveBeenCalledWith('/parts', PART_INPUT);
  });

  it('updatePart PUTs the full part body', async () => {
    mockedPut.mockResolvedValueOnce({ data: PART });
    await expect(updatePart(1, PART_INPUT)).resolves.toEqual(PART);
    expect(mockedPut).toHaveBeenCalledWith('/parts/1', PART_INPUT);
  });

  it('updatePartQuantity PUTs only quantity_current', async () => {
    mockedPut.mockResolvedValueOnce({ data: { ...PART, quantity_current: 7 } });
    await updatePartQuantity(1, 7);
    expect(mockedPut).toHaveBeenCalledWith('/parts/1', { quantity_current: 7 });
  });
});
