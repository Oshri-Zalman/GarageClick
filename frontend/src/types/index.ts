export type Role = 'Manager' | 'Secretary' | 'Mechanic';

export type TicketStatus = 'Pending' | 'In Progress' | 'Completed';

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  is_active: boolean;
}

export interface Customer {
  id: number;
  full_name: string;
  phone_number: string;
}

export interface Vehicle {
  id: number;
  customer_id: number;
  license_plate: string;
  manufacturer: string;
  model: string;
  year: number | null;
}

export interface Part {
  id: number;
  part_name: string;
  part_code: string;
  manufacturer: string | null;
  model: string | null;
  year_start: number | null;
  quantity_current: number;
}

export interface Ticket {
  id: number;
  status: TicketStatus;
  description: string;
  assigned_mechanic_id: number;
  vehicle_id: number | null;
  estimated_completion_time: string | null;
  created_at: string;
  updated_at: string;
}

// The denormalised ticket shape returned by GET /api/tickets (each list item
// joins in the vehicle, customer, and assigned mechanic). The Kanban board
// renders directly from this, so it carries more than the bare `Ticket` row.
export interface KanbanTicket {
  id: number;
  ticket_number: string;
  vehicle_id: number | null;
  created_by_id: number;
  assigned_mechanic_id: number;
  description: string;
  status: TicketStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  license_plate: string;
  manufacturer: string;
  model: string;
  year: number | null;
  customer_name: string;
  customer_phone: string;
  mechanic_name: string | null;
}

// Standard paginated envelope used by all list endpoints (TDD §7).
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface AuthToken {
  token: string;
  user_id: number;
  role: Role;
  full_name: string | null;
}

export interface ApiError {
  detail: string;
}
