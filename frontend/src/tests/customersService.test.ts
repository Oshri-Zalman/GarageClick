import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CustomerDetail, CustomerSummary } from '../types';

vi.mock('../services/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import apiClient from '../services/apiClient';
import {
  searchCustomersByPlate,
  searchCustomersByPhone,
  getCustomer,
  createCustomer,
  updateCustomer,
} from '../services/customers';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPut = vi.mocked(apiClient.put);

const DETAIL: CustomerDetail = {
  id: 10,
  full_name: 'דן כהן',
  phone_number: '0501234567',
  vehicles: [
    { id: 1, license_plate: '12-345-67', manufacturer: 'Volkswagen', model: 'Golf', year: 2018 },
  ],
};

describe('customers service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('searches by license plate via /customers/search', async () => {
    mockedGet.mockResolvedValueOnce({ data: [DETAIL] });
    const result = await searchCustomersByPlate('12-345-67');
    expect(mockedGet).toHaveBeenCalledWith('/customers/search', {
      params: { license_plate: '12-345-67' },
    });
    expect(result).toEqual([DETAIL]);
  });

  it('searches by phone via the server-side /customers/search?phone= endpoint', async () => {
    mockedGet.mockResolvedValueOnce({ data: [DETAIL] });

    const result = await searchCustomersByPhone('050-123-4567');

    // The raw query is sent as typed; the backend strips separators and matches
    // partially. We must NOT page over /api/customers anymore.
    expect(mockedGet).toHaveBeenCalledWith('/customers/search', {
      params: { phone: '050-123-4567' },
    });
    expect(mockedGet).not.toHaveBeenCalledWith('/customers', expect.anything());
    expect(result).toEqual([DETAIL]);
  });

  it('returns an empty array when no phone matches', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });
    await expect(searchCustomersByPhone('999')).resolves.toEqual([]);
    expect(mockedGet).toHaveBeenCalledWith('/customers/search', { params: { phone: '999' } });
  });

  it('fetches a customer detail by id', async () => {
    mockedGet.mockResolvedValueOnce({ data: DETAIL });
    const result = await getCustomer(10);
    expect(mockedGet).toHaveBeenCalledWith('/customers/10');
    expect(result).toEqual(DETAIL);
  });

  it('creates a customer', async () => {
    const created: CustomerSummary = { id: 11, full_name: 'חדש', phone_number: '0501112222' };
    mockedPost.mockResolvedValueOnce({ data: created });
    const result = await createCustomer({ full_name: 'חדש', phone_number: '0501112222' });
    expect(mockedPost).toHaveBeenCalledWith('/customers', {
      full_name: 'חדש',
      phone_number: '0501112222',
    });
    expect(result).toEqual(created);
  });

  it('updates a customer', async () => {
    const updated: CustomerSummary = { id: 10, full_name: 'דן ל', phone_number: '0501234567' };
    mockedPut.mockResolvedValueOnce({ data: updated });
    const result = await updateCustomer(10, { full_name: 'דן ל', phone_number: '0501234567' });
    expect(mockedPut).toHaveBeenCalledWith('/customers/10', {
      full_name: 'דן ל',
      phone_number: '0501234567',
    });
    expect(result).toEqual(updated);
  });
});
