import apiClient from './apiClient';

// Vehicle make/model catalog (Stage backend follow-up). Read-only, available to
// any authenticated role. Powers the cascading manufacturer -> model dropdowns in
// the ticket and vehicle forms. The backend still accepts free-text
// manufacturer/model, so the UI keeps an "אחר" escape hatch for values not in the
// catalog; these services only provide the suggestion lists.

// GET /api/catalog/manufacturers — all known manufacturer names, sorted.
export async function getManufacturers(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/catalog/manufacturers');
  return data;
}

// GET /api/catalog/models?manufacturer=... — models for the selected manufacturer.
export async function getModels(manufacturer: string): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/catalog/models', {
    params: { manufacturer },
  });
  return data;
}
