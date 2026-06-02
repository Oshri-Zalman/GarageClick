'use strict';

const crypto = require('crypto');
const { pool } = require('../config/db');
const {
  validateTransition,
  authorizeStatusChange,
} = require('../services/workflow');

/**
 * Tickets controller.
 *
 * Parameterized queries throughout (TDD §8.3). Multi-row creates run inside a
 * transaction so a customer/vehicle is never left orphaned if a later step fails.
 *
 * Out of scope for this step (added later): parts validation + inventory
 * deduction, audit_log writes, and the WhatsApp notification on completion.
 * The completion path marks where the notification will hook in.
 */

const SELECT_TICKET =
  'SELECT t.id, t.ticket_number, t.vehicle_id, t.created_by_id, ' +
  't.assigned_mechanic_id, t.description, t.status, ' +
  't.estimated_completion_time, t.created_at, t.started_at, t.completed_at, ' +
  'v.license_plate, v.manufacturer, v.model, v.year, ' +
  'c.id AS customer_id, c.full_name AS customer_name, c.phone_number AS customer_phone, ' +
  'u.full_name AS mechanic_name ' +
  'FROM tickets_work t ' +
  'JOIN vehicles v  ON v.id = t.vehicle_id ' +
  'JOIN customers c ON c.id = v.customer_id ' +
  'JOIN users u     ON u.id = t.assigned_mechanic_id ';

async function fetchTicket(executor, id) {
  const [rows] = await executor.query(`${SELECT_TICKET} WHERE t.id = ?`, [id]);
  return rows[0] || null;
}

// POST /api/tickets
// Scenario A (existing vehicle):
//   { vehicle_id, assigned_mechanic_id, description, estimated_completion_time? }
// Scenario B (new customer + vehicle on the fly):
//   { license_plate, new_customer:{full_name, phone_number},
//     new_vehicle:{manufacturer, model, year}, assigned_mechanic_id, description, ... }
async function createTicket(req, res, next) {
  const {
    vehicle_id,
    license_plate,
    new_customer,
    new_vehicle,
    assigned_mechanic_id,
    description,
    estimated_completion_time,
  } = req.body;

  // ---- Basic validation ----
  if (!assigned_mechanic_id) {
    return res.status(400).json({ error: '"assigned_mechanic_id" is required.' });
  }
  if (!description) {
    return res.status(400).json({ error: '"description" is required.' });
  }

  const scenarioA = !!vehicle_id;
  const scenarioB = !!(license_plate && new_customer && new_vehicle);
  if (!scenarioA && !scenarioB) {
    return res.status(400).json({
      error:
        'Provide either "vehicle_id" (existing vehicle) OR ' +
        '"license_plate" + "new_customer" + "new_vehicle" (create on the fly).',
    });
  }

  // ---- Authorization: a Mechanic may only open tickets assigned to themselves ----
  if (
    req.user.role === 'Mechanic' &&
    Number(assigned_mechanic_id) !== Number(req.user.user_id)
  ) {
    return res
      .status(403)
      .json({ error: 'A Mechanic can only open tickets assigned to themselves.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // The assigned user must exist and be active.
    const [mech] = await conn.query(
      'SELECT id FROM users WHERE id = ? AND is_active = TRUE',
      [assigned_mechanic_id]
    );
    if (mech.length === 0) {
      await conn.rollback();
      return res
        .status(400)
        .json({ error: 'assigned_mechanic_id does not refer to an active user.' });
    }

    let vehicleId = vehicle_id;

    if (scenarioB) {
      // Create customer, then vehicle, then link the ticket to them.
      const [cust] = await conn.query(
        'INSERT INTO customers (full_name, phone_number) VALUES (?, ?)',
        [new_customer.full_name, new_customer.phone_number]
      );
      const [veh] = await conn.query(
        'INSERT INTO vehicles (customer_id, license_plate, manufacturer, model, year) ' +
          'VALUES (?, ?, ?, ?, ?)',
        [
          cust.insertId,
          license_plate,
          new_vehicle.manufacturer,
          new_vehicle.model,
          new_vehicle.year ?? null,
        ]
      );
      vehicleId = veh.insertId;
    } else {
      // Existing vehicle must exist.
      const [veh] = await conn.query('SELECT id FROM vehicles WHERE id = ?', [
        vehicleId,
      ]);
      if (veh.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'vehicle_id does not exist.' });
      }
    }

    // Insert the ticket with a temporary unique number, then set the final
    // human-facing TKT-NNNNN derived from the auto-increment id.
    // Keep it short — ticket_number is VARCHAR(20). "TMP-" + 12 hex = 16 chars.
    const tempNumber = `TMP-${crypto.randomBytes(6).toString('hex')}`;
    const [ins] = await conn.query(
      'INSERT INTO tickets_work ' +
        '(ticket_number, vehicle_id, created_by_id, assigned_mechanic_id, ' +
        'description, estimated_completion_time, status) ' +
        "VALUES (?, ?, ?, ?, ?, ?, 'Pending')",
      [
        tempNumber,
        vehicleId,
        req.user.user_id,
        assigned_mechanic_id,
        description,
        estimated_completion_time ?? null,
      ]
    );

    const ticketNumber = `TKT-${String(ins.insertId).padStart(5, '0')}`;
    await conn.query('UPDATE tickets_work SET ticket_number = ? WHERE id = ?', [
      ticketNumber,
      ins.insertId,
    ]);

    const ticket = await fetchTicket(conn, ins.insertId);
    await conn.commit();

    return res.status(201).json(ticket);
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res
        .status(409)
        .json({ error: 'A vehicle with this license_plate already exists.' });
    }
    return next(err);
  } finally {
    conn.release();
  }
}

// PATCH /api/tickets/:id/status
// Body: { new_status, confirmation? }
async function updateTicketStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { new_status, confirmation } = req.body;

    if (!new_status) {
      return res.status(400).json({ error: '"new_status" is required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, status, assigned_mechanic_id FROM tickets_work WHERE id = ?',
      [id]
    );
    const ticket = rows[0];
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    // Authorize first (don't leak transition info to users who can't act).
    if (!authorizeStatusChange(req.user, ticket)) {
      return res
        .status(403)
        .json({ error: 'You are not allowed to update this ticket.' });
    }

    // Enforce the state machine.
    if (!validateTransition(ticket.status, new_status)) {
      return res.status(409).json({
        error: `Illegal transition: ${ticket.status} -> ${new_status}.`,
      });
    }

    // Completing requires explicit confirmation (FR-3 / NFR-3).
    if (new_status === 'Completed' && confirmation !== true) {
      return res.status(400).json({
        error: 'Completing a ticket requires "confirmation": true.',
      });
    }

    // Apply, stamping the matching timestamp.
    if (new_status === 'In Progress') {
      await pool.query(
        'UPDATE tickets_work SET status = ?, started_at = NOW() WHERE id = ?',
        [new_status, id]
      );
    } else if (new_status === 'Completed') {
      await pool.query(
        'UPDATE tickets_work SET status = ?, completed_at = NOW() WHERE id = ?',
        [new_status, id]
      );
      // TODO (later step): trigger WhatsApp notification + audit_log entry.
    }

    const updated = await fetchTicket(pool, id);
    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
}

// GET /api/tickets/:id  (supporting endpoint)
async function getTicketById(req, res, next) {
  try {
    const ticket = await fetchTicket(pool, req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    // A Mechanic may only view their own tickets.
    if (
      req.user.role === 'Mechanic' &&
      ticket.assigned_mechanic_id !== req.user.user_id
    ) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    return res.status(200).json(ticket);
  } catch (err) {
    return next(err);
  }
}

// GET /api/tickets?status=&mechanic_id=  (supporting endpoint)
// Manager/Secretary see all; Mechanic is forced to their own tickets.
async function listTickets(req, res, next) {
  try {
    const where = [];
    const params = [];

    if (req.user.role === 'Mechanic') {
      where.push('t.assigned_mechanic_id = ?');
      params.push(req.user.user_id);
    } else if (req.query.mechanic_id) {
      where.push('t.assigned_mechanic_id = ?');
      params.push(req.query.mechanic_id);
    }

    if (req.query.status) {
      where.push('t.status = ?');
      params.push(req.query.status);
    }

    const sql =
      SELECT_TICKET +
      (where.length ? `WHERE ${where.join(' AND ')} ` : '') +
      'ORDER BY t.created_at DESC';

    const [rows] = await pool.query(sql, params);
    return res.status(200).json(rows);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createTicket,
  updateTicketStatus,
  getTicketById,
  listTickets,
};
