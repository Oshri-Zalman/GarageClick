import apiClient from './apiClient';
import type {
  CustomerDetail,
  CustomerInput,
  CustomerSummary,
  Paginated,
} from '../types';
import { normalizePhone } from '../utils/phone';

// The search type the management screen offers (FR-1: search by phone number or
// license plate).
export type CustomerSearchType = 'phone' | 'license_plate';

// GET /api/customers/search?license_plate=... — the customer(s) that own the
// given plate, each with their vehicles. The backend returns a (usually
// single-element) array; an empty array means no match (FR-1).
export async function searchCustomersByPlate(licensePlate: string): Promise<CustomerDetail[]> {
  const { data } = await apiClient.get<CustomerDetail[]>('/customers/search', {
    params: { license_plate: licensePlate },
  });
  return data;
}

// The backend has no phone-search endpoint (only license_plate). We therefore
// search by phone client-side over GET /api/customers, paging through the list
// and keeping customers whose normalized phone contains the normalized query.
// Bounded by the reported `total`, so it terminates even for large datasets.
const PHONE_SEARCH_PAGE_SIZE = 200; // backend max `limit`.

export async function searchCustomersByPhone(phone: string): Promise<CustomerSummary[]> {
  const needle = normalizePhone(phone);
  const matches: CustomerSummary[] = [];
  let page = 1;
  let total = Infinity;
  let seen = 0;

  while (seen < total) {
    const { data } = await apiClient.get<Paginated<CustomerSummary>>('/customers', {
      params: { page, limit: PHONE_SEARCH_PAGE_SIZE },
    });
    total = data.total;
    seen += data.items.length;
    for (const c of data.items) {
      if (normalizePhone(c.phone_number).includes(needle)) {
        matches.push(c);
      }
    }
    // Guard against a non-advancing response (empty page) so we never loop forever.
    if (data.items.length === 0) break;
    page += 1;
  }

  return matches;
}

// GET /api/customers/{id} — full customer detail including the vehicle list.
export async function getCustomer(id: number): Promise<CustomerDetail> {
  const { data } = await apiClient.get<CustomerDetail>(`/customers/${id}`);
  return data;
}

// POST /api/customers — create a new customer. Returns the created summary row.
export async function createCustomer(input: CustomerInput): Promise<CustomerSummary> {
  const { data } = await apiClient.post<CustomerSummary>('/customers', input);
  return data;
}

// PUT /api/customers/{id} — update an existing customer (STAFF only on the
// backend). Returns the updated summary row.
export async function updateCustomer(
  id: number,
  input: CustomerInput
): Promise<CustomerSummary> {
  const { data } = await apiClient.put<CustomerSummary>(`/customers/${id}`, input);
  return data;
}
