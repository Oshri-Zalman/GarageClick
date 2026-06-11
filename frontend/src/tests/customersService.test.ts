import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CustomerDetail, CustomerSummary, Paginated } from '../types';

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

function page(items: CustomerSummary[], total: number, pageNum = 1): { data: Paginated<CustomerSummary> } {
  return { data: { items, page: pageNum, limit: 200, total } };
}

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

  it('searches by phone client-side over the /customers list (normalized contains)', async () => {
    const a: CustomerSummary = { id: 1, full_name: 'דן', phone_number: '050-123-4567' };
    const b: CustomerSummary = { id: 2, full_name: 'רות', phone_number: '0529999999' };
    mockedGet.mockResolvedValueOnce(page([a, b], 2));

    const result = await searchCustomersByPhone('123-4567');

    expect(mockedGet).toHaveBeenCalledWith('/customers', {
      params: { page: 1, limit: 200 },
    });
    expect(result).toEqual([a]);
  });

  it('pages through the whole customer list when searching by phone', async () => {
    const first: CustomerSummary[] = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      full_name: `c${i}`,
      phone_number: '0500000000',
    }));
    const match: CustomerSummary = { id: 201, full_name: 'מצוין', phone_number: '0507654321' };
    mockedGet.mockResolvedValueOnce(page(first, 201, 1));
    mockedGet.mockResolvedValueOnce(page([match], 201, 2));

    const result = await searchCustomersByPhone('7654321');

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(mockedGet).toHaveBeenLastCalledWith('/customers', {
      params: { page: 2, limit: 200 },
    });
    expect(result).toEqual([match]);
  });

  it('returns an empty array when no phone matches', async () => {
    mockedGet.mockResolvedValueOnce(page([{ id: 1, full_name: 'דן', phone_number: '0500000000' }], 1));
    await expect(searchCustomersByPhone('999')).resolves.toEqual([]);
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
