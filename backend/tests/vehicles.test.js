'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const {
  pool,
  resetDb,
  createUser,
  createCustomer,
  tokenFor,
  bearer,
} = require('./helpers');

const app = createApp();

let token;
let customer;

beforeEach(async () => {
  await resetDb();
  const mechanic = await createUser({ username: 'mech', role: 'Mechanic' });
  token = tokenFor(mechanic);
  customer = await createCustomer({ full_name: 'דן', phone_number: '0501234567' });
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/vehicles', () => {
  test('creates a vehicle for an existing customer', async () => {
    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', bearer(token))
      .send({
        customer_id: customer.id,
        license_plate: '999-999',
        manufacturer: 'BMW',
        model: '320i',
        year: 2020,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      license_plate: '999-999',
      manufacturer: 'BMW',
      model: '320i',
    });
  });

  test('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post('/api/vehicles').send({
      customer_id: customer.id,
      license_plate: '111-111',
      manufacturer: 'Mazda',
      model: '3',
    });
    expect(res.status).toBe(401);
  });

  test('returns 409 on duplicate license_plate', async () => {
    const body = {
      customer_id: customer.id,
      license_plate: 'DUP-001',
      manufacturer: 'Kia',
      model: 'Niro',
      year: 2021,
    };
    await request(app).post('/api/vehicles').set('Authorization', bearer(token)).send(body);
    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', bearer(token))
      .send(body);

    expect(res.status).toBe(409);
  });

  test('returns 400 when customer_id does not exist', async () => {
    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', bearer(token))
      .send({
        customer_id: 999999,
        license_plate: '777-777',
        manufacturer: 'Audi',
        model: 'A3',
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/vehicles/search', () => {
  test('returns the vehicle + owner for a known plate', async () => {
    await request(app)
      .post('/api/vehicles')
      .set('Authorization', bearer(token))
      .send({
        customer_id: customer.id,
        license_plate: '123-456',
        manufacturer: 'Volkswagen',
        model: 'Golf',
        year: 2018,
      });

    const res = await request(app)
      .get('/api/vehicles/search')
      .query({ license_plate: '123-456' })
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      license_plate: '123-456',
      manufacturer: 'Volkswagen',
      model: 'Golf',
      customer_name: 'דן',
      customer_phone: '0501234567',
    });
  });

  test('returns { found: false } for an unknown plate', async () => {
    const res = await request(app)
      .get('/api/vehicles/search')
      .query({ license_plate: 'NOPE-000' })
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ found: false });
  });
});
