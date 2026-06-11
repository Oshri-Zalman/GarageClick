import type { User } from '../types';
import type { TicketDetailsValues } from './TicketDetailsFields';

export const emptyDetails: TicketDetailsValues = {
  description: '',
  assignedMechanicId: '',
};

export interface DetailsErrors {
  description?: string;
  assignedMechanicId?: string;
}

// Validates the fields shared by both ticket forms. A Mechanic never picks a
// mechanic (they are auto-assigned), so the dropdown requirement only applies to
// Manager/Secretary.
export function validateDetails(user: User, values: TicketDetailsValues): DetailsErrors {
  const errors: DetailsErrors = {};
  if (!values.description.trim()) {
    errors.description = 'יש להזין תיאור תקלה';
  }
  if (user.role !== 'Mechanic' && !values.assignedMechanicId) {
    errors.assignedMechanicId = 'יש לבחור עובד מטפל';
  }
  return errors;
}

// The base ticket fields common to both scenarios. The assigned mechanic is the
// current user for a Mechanic, otherwise the dropdown selection.
export function buildDetailsPayload(user: User, values: TicketDetailsValues) {
  const assignedMechanicId =
    user.role === 'Mechanic' ? user.id : Number(values.assignedMechanicId);
  return {
    assigned_mechanic_id: assignedMechanicId,
    description: values.description.trim(),
    parts: [],
  };
}
