import apiClient from './apiClient';
import type {
  CustomerDetail,
  CustomerInput,
  CustomerSummary,
} from '../types';

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

// GET /api/customers/search?phone=... — partial phone search handled server-side
// (Stage 6 backend follow-up). The backend strips dashes/spaces and matches the
// stored (normalized) phone partially, returning each matching customer with
// their vehicles. We send the raw query as typed; normalization happens on the
// server. An empty array means no match (FR-1).
export async function searchCustomersByPhone(phone: string): Promise<CustomerDetail[]> {
  const { data } = await apiClient.get<CustomerDetail[]>('/customers/search', {
    params: { phone },
  });
  return data;
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
