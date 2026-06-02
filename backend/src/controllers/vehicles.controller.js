'use strict';

const { pool } = require('../config/db');

/**
 * Vehicle controller — CRUD + plate search (FR-2).
 *
 * The search endpoint is the first step of opening a work ticket: the user
 * types a plate and the system auto-fills the vehicle + owner details
 * (TDD §4.2). Parameterized queries throughout (TDD §8.3).
 */

// GET /api/vehicles/search?license_plate=123-456
// Returns the vehicle joined with its owner, or { found: false }.
async function searchVehicleByPlate(req, res, next) {
  try {
    const { license_plate } = req.query;

    if (!license_plate) {
      return res
        .status(400)
        .json({ error: 'Provide a "license_plate" query parameter.' });
    }

    const [rows] = await pool.query(
      'SELECT v.id AS vehicle_id, v.license_plate, v.manufacturer, v.model, ' +
        'v.year, c.id AS customer_id, c.full_name AS customer_name, ' +
        'c.phone_number AS customer_phone ' +
        'FROM vehicles v ' +
        'JOIN customers c ON c.id = v.customer_id ' +
        'WHERE v.license_plate = ?',
      [license_plate]
    );

    if (rows.length === 0) {
      return res.status(200).json({ found: false });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    return next(err);
  }
}

// GET /api/vehicles  -> list all (with owner name)
async function listVehicles(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT v.id, v.license_plate, v.manufacturer, v.model, v.year, ' +
        'v.customer_id, c.full_name AS customer_name ' +
        'FROM vehicles v ' +
        'JOIN customers c ON c.id = v.customer_id ' +
        'ORDER BY v.created_at DESC'
    );
    return res.status(200).json(rows);
  } catch (err) {
    return next(err);
  }
}

// GET /api/vehicles/:id
async function getVehicleById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT v.id, v.license_plate, v.manufacturer, v.model, v.year, ' +
        'v.customer_id, c.full_name AS customer_name, c.phone_number AS customer_phone ' +
        'FROM vehicles v ' +
        'JOIN customers c ON c.id = v.customer_id ' +
        'WHERE v.id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    return next(err);
  }
}

// POST /api/vehicles  -> create (any role, during ticket opening)
async function createVehicle(req, res, next) {
  try {
    const { customer_id, license_plate, manufacturer, model, year } = req.body;

    if (!customer_id || !license_plate || !manufacturer || !model) {
      return res.status(400).json({
        error:
          '"customer_id", "license_plate", "manufacturer" and "model" are required.',
      });
    }

    // Ensure the owner exists before creating the vehicle (clearer 400 than a raw FK error).
    const [owner] = await pool.query('SELECT id FROM customers WHERE id = ?', [
      customer_id,
    ]);
    if (owner.length === 0) {
      return res.status(400).json({ error: 'customer_id does not exist.' });
    }

    const [result] = await pool.query(
      'INSERT INTO vehicles (customer_id, license_plate, manufacturer, model, year) ' +
        'VALUES (?, ?, ?, ?, ?)',
      [customer_id, license_plate, manufacturer, model, year ?? null]
    );

    const [rows] = await pool.query(
      'SELECT id, customer_id, license_plate, manufacturer, model, year, created_at ' +
        'FROM vehicles WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    // Duplicate plate -> friendly 409 instead of a 500.
    if (err.code === 'ER_DUP_ENTRY') {
      return res
        .status(409)
        .json({ error: 'A vehicle with this license_plate already exists.' });
    }
    return next(err);
  }
}

// PUT /api/vehicles/:id  -> update
async function updateVehicle(req, res, next) {
  try {
    const { id } = req.params;
    const { license_plate, manufacturer, model, year } = req.body;

    const allowed = { license_plate, manufacturer, model, year };
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(allowed)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return res
        .status(400)
        .json({ error: 'Provide at least one field to update.' });
    }
    values.push(id);

    const [result] = await pool.query(
      `UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    const [rows] = await pool.query(
      'SELECT id, customer_id, license_plate, manufacturer, model, year, created_at ' +
        'FROM vehicles WHERE id = ?',
      [id]
    );

    return res.status(200).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res
        .status(409)
        .json({ error: 'A vehicle with this license_plate already exists.' });
    }
    return next(err);
  }
}

module.exports = {
  searchVehicleByPlate,
  listVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
};
