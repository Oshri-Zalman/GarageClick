'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const {
  pool,
  resetDb,
  createUser,
  tokenFor,
  bearer,
} = require('./helpers');

const app = createApp();

let mechanicToken;
let managerToken;

beforeEach(async () => {
  await resetDb();
  const mechanic = await createUser({ username: 'mech', role: 'Mechanic' });
  const manager = await createUser({ username: 'mgr', role: 'Manager' });
  mechanicToken = tokenFor(mechanic);
  managerToken = tokenFor(manager);
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/customers', () => {
  test('creates a customer (any authenticated role)', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', bearer(mechanicToken))
      .send({ full_name: 'דן כהן', phone_number: '0501234567' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      full_name: 'דן כהן',
      phone_number: '0501234567',
    });
    expect(res.body).toHaveProperty('id');
  });

  test('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/customers')
      .send({ full_name: 'דן', phone_number: '0501234567' });

    expect(res.status).toBe(401);
  });

  test('returns 400 on missing fields', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', bearer(mechanicToken))
      .send({ full_name: 'דן' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/customers/search', () => {
  test('finds a customer by their vehicle license_plate', async () => {
    // Arrange: create a customer + vehicle through the API.
    const created = await request(app)
      .post('/api/customers')
      .set('Authorization', bearer(managerToken))
      .send({ full_name: 'דן כהן', phone_number: '0501234567' });

    await request(app)
      .post('/api/vehicles')
      .set('Authorization', bearer(managerToken))
      .send({
        customer_id: created.body.id,
        license_plate: '123-456',
        manufacturer: 'Volkswagen',
        model: 'Golf',
        year: 2018,
      });

    // Act
    const res = await request(app)
      .get('/api/customers/search')
      .query({ license_plate: '123-456' })
      .set('Authorization', bearer(mechanicToken));

    // Assert
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].full_name).toBe('דן כהן');
    expect(res.body[0].vehicles[0].license_plate).toBe('123-456');
  });

  test('returns 400 without a license_plate query', async () => {
    const res = await request(app)
      .get('/api/customers/search')
      .set('Authorization', bearer(mechanicToken));

    expect(res.status).toBe(400);
  });
});
