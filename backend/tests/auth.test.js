'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { pool, resetDb, createUser } = require('./helpers');

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/auth/login', () => {
  test('returns a token + identity on correct credentials', async () => {
    await createUser({
      username: 'manager1',
      password: 'pass1234',
      role: 'Manager',
      full_name: 'Mira Manager',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'manager1', password: 'pass1234' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.role).toBe('Manager');
    expect(res.body.full_name).toBe('Mira Manager');
    expect(res.body).toHaveProperty('user_id');
  });

  test('rejects a wrong password with 401', async () => {
    await createUser({ username: 'mech1', password: 'correct', role: 'Mechanic' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'mech1', password: 'WRONG' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('rejects an unknown username with 401 (no user enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'whatever' });

    expect(res.status).toBe(401);
  });

  test('rejects an inactive user', async () => {
    await createUser({
      username: 'gone',
      password: 'pass1234',
      role: 'Secretary',
      is_active: false,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'gone', password: 'pass1234' });

    expect(res.status).toBe(401);
  });

  test('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/verify-token', () => {
  test('confirms a valid token', async () => {
    await createUser({ username: 'sec1', password: 'pass1234', role: 'Secretary' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sec1', password: 'pass1234' });

    const res = await request(app)
      .get('/api/auth/verify-token')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.role).toBe('Secretary');
  });

  test('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/verify-token');
    expect(res.status).toBe(401);
  });

  test('rejects a garbage token', async () => {
    const res = await request(app)
      .get('/api/auth/verify-token')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
  });
});
