'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const {
  pool,
  resetDb,
  createUser,
  createPart,
  tokenFor,
  bearer,
} = require('./helpers');

const app = createApp();

let managerToken;
let mechanicToken;

beforeEach(async () => {
  await resetDb();
  managerToken = tokenFor(await createUser({ username: 'mgr', role: 'Manager' }));
  mechanicToken = tokenFor(await createUser({ username: 'mech', role: 'Mechanic' }));
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/parts/compatible', () => {
  beforeEach(async () => {
    // Golf parts: one from 2015 (fits 2018), one from 2020 (does NOT fit 2018).
    await createPart({ part_name: 'Golf brakes', manufacturer: 'Volkswagen', model: 'Golf', year_start: 2015, quantity_current: 5 });
    await createPart({ part_name: 'Golf 2020 sensor', manufacturer: 'Volkswagen', model: 'Golf', year_start: 2020, quantity_current: 5 });
    await createPart({ part_name: 'Golf oil filter', manufacturer: 'Volkswagen', model: 'Golf', year_start: 2010, quantity_current: 0 });
    // A different model — must never appear for Golf.
    await createPart({ part_name: 'BMW brakes', manufacturer: 'BMW', model: '320i', year_start: 2015, quantity_current: 5 });
  });

  test('returns only parts matching make/model with year_start <= year', async () => {
    const res = await request(app)
      .get('/api/parts/compatible')
      .query({ manufacturer: 'Volkswagen', model: 'Golf', year: 2018 })
      .set('Authorization', bearer(mechanicToken));

    expect(res.status).toBe(200);
    const names = res.body.map((p) => p.part_name).sort();
    // 2015 brakes + 2010 oil filter fit 2018; the 2020 sensor and BMW part do not.
    expect(names).toEqual(['Golf brakes', 'Golf oil filter']);
  });

  test('flags out-of-stock parts as available=false but still lists them', async () => {
    const res = await request(app)
      .get('/api/parts/compatible')
      .query({ manufacturer: 'Volkswagen', model: 'Golf', year: 2018 })
      .set('Authorization', bearer(mechanicToken));

    const oil = res.body.find((p) => p.part_name === 'Golf oil filter');
    const brakes = res.body.find((p) => p.part_name === 'Golf brakes');
    expect(oil.available).toBe(false);
    expect(brakes.available).toBe(true);
  });

  test('returns 400 when query params are missing', async () => {
    const res = await request(app)
      .get('/api/parts/compatible')
      .query({ manufacturer: 'Volkswagen' })
      .set('Authorization', bearer(mechanicToken));
    expect(res.status).toBe(400);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .get('/api/parts/compatible')
      .query({ manufacturer: 'Volkswagen', model: 'Golf', year: 2018 });
    expect(res.status).toBe(401);
  });
});

describe('Parts inventory management (staff-only)', () => {
  test('Manager can create a part (201)', async () => {
    const res = await request(app)
      .post('/api/parts')
      .set('Authorization', bearer(managerToken))
      .send({ part_name: 'Spark plug', part_code: 'SPK-9', manufacturer: 'BMW', model: '320i', year_start: 2018, quantity_current: 4 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('Mechanic cannot view full inventory (403)', async () => {
    const res = await request(app)
      .get('/api/parts/inventory')
      .set('Authorization', bearer(mechanicToken));
    expect(res.status).toBe(403);
  });

  test('Mechanic cannot create a part (403)', async () => {
    const res = await request(app)
      .post('/api/parts')
      .set('Authorization', bearer(mechanicToken))
      .send({ part_name: 'x', part_code: 'y' });
    expect(res.status).toBe(403);
  });
});
