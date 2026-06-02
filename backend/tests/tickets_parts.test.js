'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const {
  pool,
  resetDb,
  createUser,
  createCustomer,
  createVehicle,
  createPart,
  partQuantity,
  tokenFor,
  bearer,
} = require('./helpers');

const app = createApp();

let secretary;
let mechanic;
let secretaryToken;
let vehicle;

beforeEach(async () => {
  await resetDb();
  secretary = await createUser({ username: 'sec', role: 'Secretary' });
  mechanic = await createUser({ username: 'mech', role: 'Mechanic' });
  secretaryToken = tokenFor(secretary);
  const customer = await createCustomer({ full_name: 'דן', phone_number: '0501234567' });
  vehicle = await createVehicle({ customer_id: customer.id, license_plate: '123-456' });
});

afterAll(async () => {
  await pool.end();
});

function openTicketWithParts(parts) {
  return request(app)
    .post('/api/tickets')
    .set('Authorization', bearer(secretaryToken))
    .send({
      vehicle_id: vehicle.id,
      assigned_mechanic_id: mechanic.id,
      description: 'החלפת בלמים',
      parts,
    });
}

describe('POST /api/tickets — parts deduction + audit', () => {
  test('deducts stock, records ticket_parts_used, and writes an audit row', async () => {
    const brakes = await createPart({ part_name: 'Brakes', quantity_current: 10 });
    const oil = await createPart({ part_name: 'Oil', part_code: 'OIL-1', quantity_current: 5 });

    const res = await openTicketWithParts([
      { part_id: brakes.id, quantity: 2 },
      { part_id: oil.id, quantity: 1 },
    ]);

    expect(res.status).toBe(201);
    const ticketId = res.body.id;

    // Inventory deducted.
    expect(await partQuantity(brakes.id)).toBe(8);
    expect(await partQuantity(oil.id)).toBe(4);

    // ticket_parts_used recorded.
    const [used] = await pool.query(
      'SELECT part_id, quantity_used FROM ticket_parts_used WHERE ticket_id = ? ORDER BY part_id',
      [ticketId]
    );
    expect(used).toHaveLength(2);

    // Audit row written.
    const [audit] = await pool.query(
      "SELECT user_id, action, resource_type, resource_id, new_value " +
        "FROM audit_log WHERE action = 'ticket_created' AND resource_id = ?",
      [ticketId]
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].user_id).toBe(secretary.id);
    expect(audit[0].resource_type).toBe('ticket');
    expect(audit[0].new_value).toBe(res.body.ticket_number);
  });

  test('quantity defaults to 1 when omitted', async () => {
    const part = await createPart({ quantity_current: 3 });
    const res = await openTicketWithParts([{ part_id: part.id }]);
    expect(res.status).toBe(201);
    expect(await partQuantity(part.id)).toBe(2);
  });

  test('allows a ticket with no parts (the "other" case) — no deduction', async () => {
    const res = await openTicketWithParts([]);
    expect(res.status).toBe(201);
    const [audit] = await pool.query(
      "SELECT COUNT(*) AS n FROM audit_log WHERE resource_id = ?",
      [res.body.id]
    );
    expect(audit[0].n).toBe(1); // audit still written for creation
  });

  test('rejects (409) and ROLLS BACK everything when a part is out of stock', async () => {
    const ok = await createPart({ part_name: 'OK part', quantity_current: 5 });
    const low = await createPart({ part_name: 'Low part', part_code: 'LOW-1', quantity_current: 1 });

    const res = await openTicketWithParts([
      { part_id: ok.id, quantity: 2 },
      { part_id: low.id, quantity: 5 }, // only 1 available -> fail
    ]);

    expect(res.status).toBe(409);

    // Nothing should have changed: stock intact, no ticket, no audit, no usage.
    expect(await partQuantity(ok.id)).toBe(5);
    expect(await partQuantity(low.id)).toBe(1);

    const [tickets] = await pool.query('SELECT COUNT(*) AS n FROM tickets_work');
    expect(tickets[0].n).toBe(0);
    const [audit] = await pool.query('SELECT COUNT(*) AS n FROM audit_log');
    expect(audit[0].n).toBe(0);
    const [used] = await pool.query('SELECT COUNT(*) AS n FROM ticket_parts_used');
    expect(used[0].n).toBe(0);
  });

  test('rejects (400) for a non-existent part_id', async () => {
    const res = await openTicketWithParts([{ part_id: 999999, quantity: 1 }]);
    expect(res.status).toBe(400);
  });

  test('rejects (400) for an invalid quantity (< 1)', async () => {
    const part = await createPart({ quantity_current: 5 });
    const res = await openTicketWithParts([{ part_id: part.id, quantity: 0 }]);
    expect(res.status).toBe(400);
  });
});
