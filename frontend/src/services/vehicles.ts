import apiClient from './apiClient';
import type { VehicleSearchHit } from '../types';

// The raw search response is a discriminated union: either { found: false } or
// the full vehicle+owner payload (which has no `found` key).
type SearchResponse = { found: false } | VehicleSearchHit;

// GET /api/vehicles/search?license_plate=... — resolves to the matching vehicle
// (auto-fill payload) or null when no vehicle owns that plate (FR-2).
export async function searchVehicle(licensePlate: string): Promise<VehicleSearchHit | null> {
  const { data } = await apiClient.get<SearchResponse>('/vehicles/search', {
    params: { license_plate: licensePlate },
  });
  if ('found' in data && data.found === false) {
    return null;
  }
  return data as VehicleSearchHit;
}
