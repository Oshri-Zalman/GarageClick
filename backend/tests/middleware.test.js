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

let managerToken;
let secretaryToken;
let mechanicToken;

beforeEach(async () => {
  await resetDb();
  managerToken = tokenFor(await createUser({ username: 'mgr', role: 'Manager' }));
  secretaryToken = tokenFor(await createUser({ username: 'sec', role: 'Secretary' }));
  mechanicToken = tokenFor(await createUser({ username: 'mech', role: 'Mechanic' }));
});

afterAll(async () => {
  await pool.end();
});

describe('authenticate middleware', () => {
  test('blocks requests without a token (401)', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });

  test('blocks malformed Authorization headers (401)', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
  });

  test('blocks invalid/forged tokens (401)', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', 'Bearer aaa.bbb.ccc');
    expect(res.status).toBe(401);
  });
});

describe('authorize middleware — staff-only routes', () => {
  // GET /api/customers (list all) is restricted to Manager + Secretary.
  test('Manager is allowed (200)', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', bearer(managerToken));
    expect(res.status).toBe(200);
  });

  test('Secretary is allowed (200)', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', bearer(secretaryToken));
    expect(res.status).toBe(200);
  });

  test('Mechanic is forbidden (403)', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', bearer(mechanicToken));
    expect(res.status).toBe(403);
  });

  test('Mechanic cannot update a customer profile (403)', async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .put(`/api/customers/${customer.id}`)
      .set('Authorization', bearer(mechanicToken))
      .send({ full_name: 'Hacker' });
    expect(res.status).toBe(403);
  });
});

describe('authorize middleware — shared routes', () => {
  // POST /api/customers is open to all three authenticated roles.
  test('Mechanic can create a customer (201)', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', bearer(mechanicToken))
      .send({ full_name: 'דן', phone_number: '0501234567' });
    expect(res.status).toBe(201);
  });
});
