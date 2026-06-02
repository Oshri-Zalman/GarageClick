'use strict';

const {
  validateTransition,
  authorizeStatusChange,
} = require('../src/services/workflow');

describe('workflow.validateTransition', () => {
  test('allows Pending -> In Progress', () => {
    expect(validateTransition('Pending', 'In Progress')).toBe(true);
  });

  test('allows In Progress -> Completed', () => {
    expect(validateTransition('In Progress', 'Completed')).toBe(true);
  });

  test('rejects skipping Pending -> Completed', () => {
    expect(validateTransition('Pending', 'Completed')).toBe(false);
  });

  test('rejects moving backwards In Progress -> Pending', () => {
    expect(validateTransition('In Progress', 'Pending')).toBe(false);
  });

  test('rejects any change out of Completed (terminal)', () => {
    expect(validateTransition('Completed', 'In Progress')).toBe(false);
    expect(validateTransition('Completed', 'Pending')).toBe(false);
  });

  test('rejects unknown statuses', () => {
    expect(validateTransition('Bogus', 'Completed')).toBe(false);
  });
});

describe('workflow.authorizeStatusChange', () => {
  const ticket = { assigned_mechanic_id: 5 };

  test('Manager may change any ticket', () => {
    expect(authorizeStatusChange({ user_id: 1, role: 'Manager' }, ticket)).toBe(true);
  });

  test('Secretary may change any ticket', () => {
    expect(authorizeStatusChange({ user_id: 2, role: 'Secretary' }, ticket)).toBe(true);
  });

  test('Mechanic may change only their own ticket', () => {
    expect(authorizeStatusChange({ user_id: 5, role: 'Mechanic' }, ticket)).toBe(true);
    expect(authorizeStatusChange({ user_id: 9, role: 'Mechanic' }, ticket)).toBe(false);
  });

  test('unknown role is denied', () => {
    expect(authorizeStatusChange({ user_id: 1, role: 'Ghost' }, ticket)).toBe(false);
  });
});
