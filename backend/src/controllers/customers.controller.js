'use strict';

const { pool } = require('../config/db');

/**
 * Customer controller — CRUD + search (FR-1).
 *
 * Every query is parameterized (`?`) to prevent SQL injection (TDD §8.3).
 * Role-based authorization is intentionally NOT enforced here yet; the auth
 * middleware is built in a later step and will be attached in the router.
 */

// GET /api/customers/search?license_plate=...
// Looks up the customer that owns the given plate, with their vehicles array.
async function searchCustomers(req, res, next) {
  try {
    const { license_plate } = req.query;

    if (!license_plate) {
      return res
        .status(400)
        .json({ error: 'Provide a "license_plate" query parameter.' });
    }

    // Find the customer that owns the given plate.
    const [rows] = await pool.query(
      'SELECT c.id, c.full_name, c.phone_number, c.created_at, c.updated_at ' +
        'FROM customers c ' +
        'JOIN vehicles v ON v.customer_id = c.id ' +
        'WHERE v.license_plate = ?',
      [license_plate]
    );

    // Attach each customer's vehicles.
    const customers = await Promise.all(
      rows.map(async (customer) => {
        const [vehicles] = await pool.query(
          'SELECT id, license_plate, manufacturer, model, year ' +
            'FROM vehicles WHERE customer_id = ?',
          [customer.id]
        );
        return { ...customer, vehicles };
      })
    );

    return res.status(200).json(customers);
  } catch (err) {
    return next(err);
  }
}

// GET /api/customers/:id  -> customer + vehicles
async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT id, full_name, phone_number, created_at, updated_at ' +
        'FROM customers WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const [vehicles] = await pool.query(
      'SELECT id, license_plate, manufacturer, model, year ' +
        'FROM vehicles WHERE customer_id = ?',
      [id]
    );

    return res.status(200).json({ ...rows[0], vehicles });
  } catch (err) {
    return next(err);
  }
}

// GET /api/customers  -> list all
async function listCustomers(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name, phone_number, created_at, updated_at ' +
        'FROM customers ORDER BY created_at DESC'
    );
    return res.status(200).json(rows);
  } catch (err) {
    return next(err);
  }
}

// POST /api/customers  -> create
async function createCustomer(req, res, next) {
  try {
    const { full_name, phone_number } = req.body;

    if (!full_name || !phone_number) {
      return res
        .status(400)
        .json({ error: '"full_name" and "phone_number" are required.' });
    }

    const [result] = await pool.query(
      'INSERT INTO customers (full_name, phone_number) VALUES (?, ?)',
      [full_name, phone_number]
    );

    const [rows] = await pool.query(
      'SELECT id, full_name, phone_number, created_at, updated_at ' +
        'FROM customers WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    return next(err);
  }
}

// PUT /api/customers/:id  -> update
async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const { full_name, phone_number } = req.body;

    if (!full_name && !phone_number) {
      return res
        .status(400)
        .json({ error: 'Provide at least one field to update.' });
    }

    // Build a dynamic SET clause from only the provided fields.
    const fields = [];
    const values = [];
    if (full_name) {
      fields.push('full_name = ?');
      values.push(full_name);
    }
    if (phone_number) {
      fields.push('phone_number = ?');
      values.push(phone_number);
    }
    values.push(id);

    const [result] = await pool.query(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const [rows] = await pool.query(
      'SELECT id, full_name, phone_number, created_at, updated_at ' +
        'FROM customers WHERE id = ?',
      [id]
    );

    return res.status(200).json(rows[0]);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  searchCustomers,
  getCustomerById,
  listCustomers,
  createCustomer,
  updateCustomer,
};
