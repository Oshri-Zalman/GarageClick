'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const {
  pool,
  resetDb,
  createUser,
  createCustomer,
  createVehicle,
  tokenFor,
  bearer,
} = require('./helpers');

const app = createApp();

let manager;
let secretary;
let mechanic;
let otherMechanic;
let managerToken;
let secretaryToken;
let mechanicToken;
let otherMechanicToken;
let vehicle;

beforeEach(async () => {
  await resetDb();
  manager = await createUser({ username: 'mgr', role: 'Manager' });
  secretary = await createUser({ username: 'sec', role: 'Secretary' });
  mechanic = await createUser({ username: 'mech', role: 'Mechanic' });
  otherMechanic = await createUser({ username: 'mech2', role: 'Mechanic' });
  managerToken = tokenFor(manager);
  secretaryToken = tokenFor(secretary);
  mechanicToken = tokenFor(mechanic);
  otherMechanicToken = tokenFor(otherMechanic);

  const customer = await createCustomer({ full_name: 'דן', phone_number: '0501234567' });
  vehicle = await createVehicle({ customer_id: customer.id, license_plate: '123-456' });
});

afterAll(async () => {
  await pool.end();
});

// Helper: open a ticket for the existing vehicle, assigned to `mechanic`.
async function openTicket(token, overrides = {}) {
  return request(app)
    .post('/api/tickets')
    .set('Authorization', bearer(token))
    .send({
      vehicle_id: vehicle.id,
      assigned_mechanic_id: mechanic.id,
      description: 'החלפת בלמים',
      ...overrides,
    });
}

describe('POST /api/tickets — scenario A (existing vehicle)', () => {
  test('Secretary opens a ticket for an existing vehicle (201)', async () => {
    const res = await openTicket(secretaryToken);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Pending');
    expect(res.body.ticket_number).toMatch(/^TKT-\d{5}$/);
    expect(res.body.vehicle_id).toBe(vehicle.id);
    expect(res.body.assigned_mechanic_id).toBe(mechanic.id);
    expect(res.body.created_by_id).toBe(secretary.id);
    expect(res.body.license_plate).toBe('123-456');
  });

  test('rejects an unauthenticated request (401)', async () => {
    const res = await request(app).post('/api/tickets').send({
      vehicle_id: vehicle.id,
      assigned_mechanic_id: mechanic.id,
      description: 'x',
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when description is missing', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer(secretaryToken))
      .send({ vehicle_id: vehicle.id, assigned_mechanic_id: mechanic.id });
    expect(res.status).toBe(400);
  });

  test('returns 400 for a non-existent vehicle_id', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer(secretaryToken))
      .send({ vehicle_id: 999999, assigned_mechanic_id: mechanic.id, description: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tickets — Mechanic self-assignment rule', () => {
  test('Mechanic may open a ticket assigned to themselves (201)', async () => {
    const res = await openTicket(mechanicToken, { assigned_mechanic_id: mechanic.id });
    expect(res.status).toBe(201);
  });

  test('Mechanic may NOT assign a ticket to another mechanic (403)', async () => {
    const res = await openTicket(mechanicToken, {
      assigned_mechanic_id: otherMechanic.id,
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/tickets — scenario B (new customer + vehicle on the fly)', () => {
  test('creates customer, vehicle, and ticket together (201)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer(managerToken))
      .send({
        license_plate: '999-999',
        new_customer: { full_name: 'דוד', phone_number: '050987654321' },
        new_vehicle: { manufacturer: 'BMW', model: '320i', year: 2020 },
        assigned_mechanic_id: mechanic.id,
        description: 'החלפת שמן',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Pending');
    expect(res.body.license_plate).toBe('999-999');
    expect(res.body.manufacturer).toBe('BMW');
    expect(res.body.customer_name).toBe('דוד');

    // The vehicle is now findable via the plate-search endpoint.
    const search = await request(app)
      .get('/api/vehicles/search')
      .query({ license_plate: '999-999' })
      .set('Authorization', bearer(managerToken));
    expect(search.body.model).toBe('320i');
  });

  test('rolls back (no orphan customer) when the plate already exists (409)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', bearer(managerToken))
      .send({
        license_plate: '123-456', // already used by the seeded vehicle
        new_customer: { full_name: 'כפיל', phone_number: '0500000000' },
        new_vehicle: { manufacturer: 'Kia', model: 'Niro', year: 2021 },
        assigned_mechanic_id: mechanic.id,
        description: 'x',
      });

    expect(res.status).toBe(409);

    // The transaction must have rolled back: "כפיל" should not exist.
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS n FROM customers WHERE full_name = ?',
      ['כפיל']
    );
    expect(rows[0].n).toBe(0);
  });
});

describe('PATCH /api/tickets/:id/status — state machine', () => {
  async function newTicketId(token = secretaryToken) {
    const res = await openTicket(token);
    return res.body.id;
  }

  test('Pending -> In Progress sets started_at (200)', async () => {
    const id = await newTicketId();
    const res = await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set('Authorization', bearer(mechanicToken))
      .send({ new_status: 'In Progress' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('In Progress');
    expect(res.body.started_at).not.toBeNull();
  });

  test('full path to Completed sets completed_at (200)', async () => {
    const id = await newTicketId();
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set('Authorization', bearer(mechanicToken))
      .send({ new_status: 'In Progress' });

    const res = await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set('Authorization', bearer(mechanicToken))
      .send({ new_status: 'Completed', confirmation: true });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Completed');
    expect(res.body.completed_at).not.toBeNull();
  });

  test('completing without confirmation is rejected (400)', async () => {
    const id = await newTicketId();
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set('Authorization', bearer(mechanicToken))
      .send({ new_status: 'In Progress' });

    const res = await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set('Authorization', bearer(mechanicToken))
      .send({ new_status: 'Completed' }); // no confirmation
    expect(res.status).toBe(400);
  });

  test('illegal transition Pending -> Completed is rejected (409)', async () => {
    const id = await newTicketId();
    const res = await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set('Authorization', bearer(managerToken))
      .send({ new_status: 'Completed', confirmation: true });
    expect(res.status).toBe(409);
  });

  test('a completed ticket cannot transition again (409)', async () => {
    const id = await newTicketId();
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set('Authorization', bearer(managerToken))
      .send({ new_status: 'In Progress' });
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set('Authorization', bearer(managerToken))
      .send({ new_status: 'Completed', confirmation: true });

    const res = await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set('Authorization', bearer(managerToken))
      .send({ new_status: 'In Progress' });
    expect(res.status).toBe(409);
  });

  test('a Mechanic cannot update a ticket assigned to someone else (403)', async () => {
    const id = await newTicketId();
    const res = await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set('Authorization', bearer(otherMechanicToken))
      .send({ new_status: 'In Progress' });
    expect(res.status).toBe(403);
  });

  test('returns 404 for an unknown ticket', async () => {
    const res = await request(app)
      .patch('/api/tickets/999999/status')
      .set('Authorization', bearer(managerToken))
      .send({ new_status: 'In Progress' });
    expect(res.status).toBe(404);
  });
});
