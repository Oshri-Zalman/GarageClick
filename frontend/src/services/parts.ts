import apiClient from './apiClient';
import type { CompatiblePart, Paginated, Part, PartInput } from '../types';

// GET /api/parts/compatible?manufacturer=...&model=...&year=... — returns the
// parts that fit the given vehicle (year_start <= year). Out-of-stock parts are
// included with `available: false` so the UI can show them disabled (FR-7.2 /
// TDD §4.4). `year` is optional: when it is null/undefined the param is omitted
// and the backend matches by manufacturer/model only (skipping the year filter),
// which lets existing vehicles with no recorded year still load parts. Errors
// propagate so the caller can show a Hebrew error + retry.
export async function getCompatibleParts(
  manufacturer: string,
  model: string,
  year?: number | null
): Promise<CompatiblePart[]> {
  const params: Record<string, string | number> = { manufacturer, model };
  if (year != null) params.year = year;
  const { data } = await apiClient.get<CompatiblePart[]>('/parts/compatible', { params });
  return data;
}

// Backend `limit` cap for list endpoints (see pagination.py).
const INVENTORY_PAGE_SIZE = 200;

// Server-side inventory filters (Stage 7 backend follow-up). manufacturer/model
// are matched exactly; part_name/part_code are partial (LIKE). Blank fields are
// omitted from the request.
export interface InventoryQuery {
  manufacturer?: string;
  model?: string;
  part_name?: string;
  part_code?: string;
  page?: number;
  limit?: number;
}

// GET /api/parts/inventory — one filtered + paginated page of the parts inventory
// (STAFF only on the backend: Manager/Secretary). Filtering is done server-side,
// so the management screen no longer pulls the whole inventory to filter locally.
// Returns the standard paginated envelope.
export async function getInventory(query: InventoryQuery = {}): Promise<Paginated<Part>> {
  const { page = 1, limit = INVENTORY_PAGE_SIZE, manufacturer, model, part_name, part_code } = query;
  const params: Record<string, string | number> = { page, limit };
  if (manufacturer) params.manufacturer = manufacturer;
  if (model) params.model = model;
  if (part_name) params.part_name = part_name;
  if (part_code) params.part_code = part_code;

  const { data } = await apiClient.get<Paginated<Part>>('/parts/inventory', { params });
  return data;
}

// Fetches the entire inventory by paging through GET /api/parts/inventory.
// Bounded by the reported `total`, so it terminates even for large datasets.
export async function getAllParts(): Promise<Part[]> {
  const all: Part[] = [];
  let page = 1;
  let total = Infinity;

  while (all.length < total) {
    const data = await getInventory({ page, limit: INVENTORY_PAGE_SIZE });
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
