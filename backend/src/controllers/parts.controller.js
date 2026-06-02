'use strict';

const { pool } = require('../config/db');

/**
 * Parts controller (TDD §4.4).
 *
 * The compatibility lookup is what the ticket form uses to show only the
 * parts that fit the selected vehicle. Parameterized queries throughout.
 */

// GET /api/parts/compatible?manufacturer=Volkswagen&model=Golf&year=2018
// A part matches when manufacturer + model match and year_start <= year.
// Returns ALL matches (including out-of-stock) plus an `available` flag, so the
// frontend can render zero-stock parts as disabled (FR-7.2).
async function getCompatible(req, res, next) {
  try {
    const { manufacturer, model, year } = req.query;

    if (!manufacturer || !model || !year) {
      return res.status(400).json({
        error: '"manufacturer", "model" and "year" query params are required.',
      });
    }

    const [rows] = await pool.query(
      'SELECT id, part_name, part_code, manufacturer, model, year_start, ' +
        'quantity_current, (quantity_current > 0) AS available ' +
        'FROM parts_inventory ' +
        'WHERE manufacturer = ? AND model = ? AND year_start <= ? ' +
        'ORDER BY part_name',
      [manufacturer, model, year]
    );

    // MySQL returns the boolean expression as 1/0 — normalize to true/false.
    const parts = rows.map((r) => ({ ...r, available: r.available === 1 }));
    return res.status(200).json(parts);
  } catch (err) {
    return next(err);
  }
}

// GET /api/parts/inventory  -> full stock list (Manager/Secretary)
async function listInventory(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, part_name, part_code, manufacturer, model, year_start, ' +
        'quantity_current, created_at, updated_at ' +
        'FROM parts_inventory ORDER BY part_name'
    );
    return res.status(200).json(rows);
  } catch (err) {
    return next(err);
  }
}

// POST /api/parts  -> add a part (Manager/Secretary)
async function createPart(req, res, next) {
  try {
    const {
      part_name,
      part_code,
      manufacturer,
      model,
      year_start,
      quantity_current,
    } = req.body;

    if (!part_name || !part_code) {
      return res
        .status(400)
        .json({ error: '"part_name" and "part_code" are required.' });
    }

    const [result] = await pool.query(
      'INSERT INTO parts_inventory ' +
        '(part_name, part_code, manufacturer, model, year_start, quantity_current) ' +
        'VALUES (?, ?, ?, ?, ?, ?)',
      [
        part_name,
        part_code,
        manufacturer ?? null,
        model ?? null,
        year_start ?? null,
        quantity_current ?? 0,
      ]
    );

    const [rows] = await pool.query(
      'SELECT id, part_name, part_code, manufacturer, model, year_start, ' +
        'quantity_current, created_at, updated_at FROM parts_inventory WHERE id = ?',
      [result.insertId]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return next(err);
  }
}

// PUT /api/parts/:id  -> update fields (e.g. restock quantity) (Manager/Secretary)
async function updatePart(req, res, next) {
  try {
    const { id } = req.params;
    const allowed = {
      part_name: req.body.part_name,
      part_code: req.body.part_code,
      manufacturer: req.body.manufacturer,
      model: req.body.model,
      year_start: req.body.year_start,
      quantity_current: req.body.quantity_current,
    };

    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(allowed)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Provide at least one field to update.' });
    }
    values.push(id);

    const [result] = await pool.query(
      `UPDATE parts_inventory SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Part not found.' });
    }

    const [rows] = await pool.query(
      'SELECT id, part_name, part_code, manufacturer, model, year_start, ' +
        'quantity_current, created_at, updated_at FROM parts_inventory WHERE id = ?',
      [id]
    );
    return res.status(200).json(rows[0]);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getCompatible, listInventory, createPart, updatePart };
