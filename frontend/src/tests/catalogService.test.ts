import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn() },
}));

import apiClient from '../services/apiClient';
import { getManufacturers, getModels } from '../services/catalog';

const mockedGet = vi.mocked(apiClient.get);

describe('catalog service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the manufacturer catalog from GET /catalog/manufacturers', async () => {
    mockedGet.mockResolvedValueOnce({ data: ['Audi', 'BMW', 'Toyota'] });
    await expect(getManufacturers()).resolves.toEqual(['Audi', 'BMW', 'Toyota']);
    expect(mockedGet).toHaveBeenCalledWith('/catalog/manufacturers');
  });

  it('loads models for a manufacturer from GET /catalog/models', async () => {
    mockedGet.mockResolvedValueOnce({ data: ['Corolla', 'Yaris'] });
    await expect(getModels('Toyota')).resolves.toEqual(['Corolla', 'Yaris']);
    expect(mockedGet).toHaveBeenCalledWith('/catalog/models', {
      params: { manufacturer: 'Toyota' },
    });
  });
});
