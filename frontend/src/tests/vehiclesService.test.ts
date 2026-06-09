import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VehicleSearchHit } from '../types';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn() },
}));

import apiClient from '../services/apiClient';
import { searchVehicle } from '../services/vehicles';

const mockedGet = vi.mocked(apiClient.get);

const HIT: VehicleSearchHit = {
  vehicle_id: 50,
  license_plate: '123-45-678',
  manufacturer: 'Volkswagen',
  model: 'Golf',
  year: 2018,
  customer_id: 10,
  customer_name: 'דן',
  customer_phone: '0501234567',
};

describe('searchVehicle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the correct endpoint with the license_plate query', async () => {
    mockedGet.mockResolvedValueOnce({ data: HIT });
    await searchVehicle('123-45-678');
    expect(mockedGet).toHaveBeenCalledWith('/vehicles/search', {
      params: { license_plate: '123-45-678' },
    });
  });

  it('maps { found: false } to null (new-vehicle flow)', async () => {
    mockedGet.mockResolvedValueOnce({ data: { found: false } });
    await expect(searchVehicle('999-999')).resolves.toBeNull();
  });

  it('returns the vehicle payload when found', async () => {
    mockedGet.mockResolvedValueOnce({ data: HIT });
    await expect(searchVehicle('123-45-678')).resolves.toEqual(HIT);
  });
});
