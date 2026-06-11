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

// A row from GET /api/parts/compatible. The backend flags `available` (stock > 0)
// so the UI can show out-of-stock parts as disabled (FR-7.2).
export interface CompatiblePart {
  id: number;
  part_name: string;
  part_code: string;
  manufacturer: string | null;
  model: string | null;
  year_start: number | null;
  quantity_current: number;
  available: boolean;
}

// A single part the user chose to use on the ticket — the exact shape POSTed in
// the `parts` array of POST /api/tickets.
export interface SelectedPart {
  part_id: number;
  quantity: number;
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

// Result of GET /api/vehicles/search. The backend returns either the full
// vehicle+owner payload (auto-fill, FR-2 option A) or { found: false }.
export interface VehicleSearchHit {
  vehicle_id: number;
  license_plate: string;
  manufacturer: string;
  model: string;
  year: number | null;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
}

// An assignable worker shown in the "assigned mechanic" dropdown. Only
// Manager/Secretary pick one; a Mechanic is always assigned to themselves.
export interface Mechanic {
  id: number;
  name: string;
  role: Role;
}

// POST /api/tickets — scenario A (existing vehicle, by id).
export interface CreateTicketExisting {
  vehicle_id: number;
  assigned_mechanic_id: number;
  description: string;
  parts?: { part_id: number; quantity: number }[];
}

// POST /api/tickets — scenario B (new customer + new vehicle, by plate).
export interface CreateTicketNew {
  license_plate: string;
  new_customer: { full_name: string; phone_number: string };
  new_vehicle: { manufacturer: string; model: string; year: number | null };
  assigned_mechanic_id: number;
  description: string;
  parts?: { part_id: number; quantity: number }[];
}

export type CreateTicketPayload = CreateTicketExisting | CreateTicketNew;

export interface AuthToken {
  token: string;
  user_id: number;
  role: Role;
  full_name: string | null;
}

export interface ApiError {
  detail: string;
}
