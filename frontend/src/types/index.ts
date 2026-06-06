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

export interface AuthToken {
  token: string;
  user_id: number;
  role: Role;
  full_name: string | null;
}

export interface ApiError {
  detail: string;
}
