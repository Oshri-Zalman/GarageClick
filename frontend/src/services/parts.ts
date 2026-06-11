import apiClient from './apiClient';
import type { CompatiblePart } from '../types';

// GET /api/parts/compatible?manufacturer=...&model=...&year=... — returns the
// parts that fit the given vehicle (year_start <= year). Out-of-stock parts are
// included with `available: false` so the UI can show them disabled (FR-7.2 /
// TDD §4.4). Errors propagate so the caller can show a Hebrew error + retry.
export async function getCompatibleParts(
  manufacturer: string,
  model: string,
  year: number
): Promise<CompatiblePart[]> {
  const { data } = await apiClient.get<CompatiblePart[]>('/parts/compatible', {
    params: { manufacturer, model, year },
  });
  return data;
}
