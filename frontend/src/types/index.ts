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

// A user row from GET /api/admin/users (Manager-only user management, FR-6.4 /
// Stage 9). `password_hash` is never returned by the backend. `full_name` and
// `email` are nullable; `created_at` is an ISO timestamp.
export interface ManagedUser {
  id: number;
  username: string;
  role: Role;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

// POST /api/admin/users — create a user. `password` is the temporary password the
// new user signs in with. `email` is optional.
export interface CreateUserInput {
  username: string;
  password: string;
  role: Role;
  full_name: string;
  email?: string | null;
}

// PATCH /api/admin/users/{id} — partial update. Every field is optional; the
// backend applies only those present (full name/role edit, activate/deactivate
// via is_active, reset temporary password via password).
export interface UpdateUserInput {
  full_name?: string;
  role?: Role;
  is_active?: boolean;
  password?: string;
  email?: string | null;
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

// A vehicle as nested inside a customer detail / search payload
// (GET /api/customers/{id}, GET /api/customers/search). The backend omits
// customer_id here since the owner is the enclosing customer.
export interface CustomerVehicle {
  id: number;
  license_plate: string;
  manufacturer: string;
  model: string;
  year: number | null;
}

// The bare customer row returned by GET /api/customers and POST/PUT
// /api/customers (no vehicles attached).
export interface CustomerSummary {
  id: number;
  full_name: string;
  phone_number: string;
}

// GET /api/customers/{id} and each item of GET /api/customers/search — the
// customer plus the list of vehicles they own (FR-1).
export interface CustomerDetail extends CustomerSummary {
  vehicles: CustomerVehicle[];
}

// Editable customer fields (create + edit forms).
export interface CustomerInput {
  full_name: string;
  phone_number: string;
}

// Editable vehicle fields (create + edit forms). The owning customer is passed
// separately on create; on edit only these fields change.
export interface VehicleInput {
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

// Editable part fields (inventory create + edit forms, FR-7.1). manufacturer,
// model and year_start are nullable: a "universal" part (fits all vehicles) is
// sent with all three null, which the backend treats as wildcard dimensions in
// GET /api/parts/compatible.
export interface PartInput {
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
  // Set when the ticket has been closed/archived (Stage 8). The active board list
  // omits archived tickets, but the archive response carries this timestamp.
  archived_at?: string | null;
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

// GET /api/admin/tickets/summary — status counts plus the average completion
// time across completed tickets (Manager only). `avg_completion_minutes` is null
// when no completed ticket has both a start and completion timestamp.
export interface TicketsSummary {
  total_pending: number;
  total_in_progress: number;
  total_completed: number;
  avg_completion_minutes: number | null;
}

// GET /api/admin/employees — team monitoring row (Manager only). `online` and
// `last_login` may be null: real-time presence is not tracked by the backend and
// last_login is only set once a user has logged in.
export interface EmployeeMonitorRow {
  id: number;
  name: string | null;
  role: Role;
  online: boolean | null;
  last_login: string | null;
  tickets_open: number;
  tickets_completed_today: number;
}

// GET /api/admin/tickets/by-day — per-day workload row (Manager only).
export interface TicketsByDayRow {
  date: string;
  tickets_created: number;
  tickets_completed: number;
  avg_completion_minutes: number | null;
}

// GET /api/admin/reports/performance — quality-oriented metrics for a single
// mechanic (Manager only). The backend does not model ticket difficulty or a
// quality score yet, so only the time/throughput metrics are exposed.
export interface PerformanceReport {
  mechanic_id: number;
  mechanic_name: string | null;
  tickets_completed: number;
  total_work_hours: number;
  avg_time_per_ticket_minutes: number | null;
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
