'use strict';

/**
 * Workflow Service — the backend State Machine for work tickets.
 *
 * Why backend-enforced (TDD §6.1): the frontend is never trusted to decide a
 * legal status change. Every transition flows through validateTransition() so
 * the rules are consistent and auditable.
 *
 * Legal lifecycle:  Pending -> In Progress -> Completed  (no going back)
 */

const VALID_TRANSITIONS = Object.freeze({
  Pending: ['In Progress'],
  'In Progress': ['Completed'],
  Completed: [], // terminal — a completed ticket is closed
});

const STATUSES = Object.freeze(['Pending', 'In Progress', 'Completed']);

/**
 * Is moving from currentStatus -> newStatus allowed by the state machine?
 * @returns {boolean}
 */
function validateTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) return false; // unknown current status
  return allowed.includes(newStatus);
}

/**
 * May this user change the status of this ticket? (TDD §4.5)
 *   - Manager   : any ticket
 *   - Secretary : any ticket (flexibility — see SRS §6.4)
 *   - Mechanic  : only tickets assigned to them
 *
 * @param {{user_id:number, role:string}} user
 * @param {{assigned_mechanic_id:number}} ticket
 * @returns {boolean}
 */
function authorizeStatusChange(user, ticket) {
  if (!user || !ticket) return false;
  if (user.role === 'Manager' || user.role === 'Secretary') return true;
  if (user.role === 'Mechanic') {
    return ticket.assigned_mechanic_id === user.user_id;
  }
  return false;
}

module.exports = {
  VALID_TRANSITIONS,
  STATUSES,
  validateTransition,
  authorizeStatusChange,
};
