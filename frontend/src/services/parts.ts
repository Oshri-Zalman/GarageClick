import apiClient from './apiClient';
import type { CompatiblePart, Paginated, Part, PartInput } from '../types';

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

// Backend `limit` cap for list endpoints (see pagination.py).
const INVENTORY_PAGE_SIZE = 200;

// GET /api/parts/inventory — one page of the parts inventory (STAFF only on the
// backend: Manager/Secretary). Returns the standard paginated envelope.
export async function getInventory(
  page = 1,
  limit = INVENTORY_PAGE_SIZE
): Promise<Paginated<Part>> {
  const { data } = await apiClient.get<Paginated<Part>>('/parts/inventory', {
    params: { page, limit },
  });
  return data;
}

// Fetches the entire inventory by paging through GET /api/parts/inventory. The
// management screen filters/searches client-side, so it needs the full set.
// Bounded by the reported `total`, so it terminates even for large datasets.
export async function getAllParts(): Promise<Part[]> {
  const all: Part[] = [];
  let page = 1;
  let total = Infinity;

  while (all.length < total) {
    const data = await getInventory(page, INVENTORY_PAGE_SIZE);
    total = data.total;
    all.push(...data.items);
    // Guard against a non-advancing response (empty page) so we never loop forever.
    if (data.items.length === 0) break;
    page += 1;
  }

  return all;
}

// POST /api/parts — create a new inventory part (STAFF only). Returns the created
// part row.
export async function createPart(input: PartInput): Promise<Part> {
  const { data } = await apiClient.post<Part>('/parts', input);
  return data;
}

// PUT /api/parts/{id} — update an existing part (STAFF only). Returns the updated
// part row.
export async function updatePart(id: number, input: PartInput): Promise<Part> {
  const { data } = await apiClient.put<Part>(`/parts/${id}`, input);
  return data;
}

// Quantity-only update. The backend has no dedicated quantity endpoint, but
// PUT /api/parts/{id} accepts a partial body, so we send just quantity_current.
export async function updatePartQuantity(id: number, quantity: number): Promise<Part> {
  const { data } = await apiClient.put<Part>(`/parts/${id}`, { quantity_current: quantity });
  return data;
}
