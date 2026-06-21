import { describe, it, expect } from 'vitest';
import { filterArchivedForUser, isArchived, formatDateTime } from '../utils/myTickets';
import type { KanbanTicket, User } from '../types';

// IDs used across the role-scoping fixtures.
const ME = 10;
const OTHER = 20;

function makeUser(role: User['role'], id = ME): User {
  return { id, username: 'u', full_name: 'משתמש', email: null, role, is_active: true };
}

function makeTicket(overrides: Partial<KanbanTicket>): KanbanTicket {
  return {
    id: 0,
    ticket_number: 'TKT-00000',
    vehicle_id: 1,
    created_by_id: ME,
    assigned_mechanic_id: ME,
    description: 'תיאור',
    status: 'Completed',
    created_at: '2026-06-01T08:00:00Z',
    started_at: null,
    completed_at: null,
    archived_at: null,
    license_plate: '00-000-00',
    manufacturer: 'Toyota',
    model: 'Corolla',
    year: 2020,
    customer_name: 'לקוח',
    customer_phone: '0500000000',
    mechanic_name: 'דוד',
    ...overrides,
  };
}

const ARCHIVED_AT = '2026-06-18T10:00:00Z';

describe('isArchived', () => {
  it('treats a ticket as archived only when archived_at has a value', () => {
    expect(isArchived(makeTicket({ archived_at: ARCHIVED_AT }))).toBe(true);
    expect(isArchived(makeTicket({ archived_at: null }))).toBe(false);
  });

  it('a Completed but non-archived ticket is NOT archived (still active on the board)', () => {
    expect(isArchived(makeTicket({ status: 'Completed', archived_at: null }))).toBe(false);
  });
});

describe('filterArchivedForUser', () => {
  it('excludes active (non-archived) tickets entirely', () => {
    const tickets = [
      makeTicket({ id: 1, archived_at: null }),
      makeTicket({ id: 2, status: 'Completed', archived_at: null }),
      makeTicket({ id: 3, archived_at: ARCHIVED_AT }),
    ];
    const result = filterArchivedForUser(tickets, makeUser('Manager'));
    expect(result.map((t) => t.id)).toEqual([3]);
  });

  it('Mechanic sees only archived tickets assigned to themselves', () => {
    const tickets = [
      makeTicket({ id: 1, archived_at: ARCHIVED_AT, assigned_mechanic_id: ME }),
      makeTicket({ id: 2, archived_at: ARCHIVED_AT, assigned_mechanic_id: OTHER }),
      makeTicket({ id: 3, archived_at: null, assigned_mechanic_id: ME }),
    ];
    const result = filterArchivedForUser(tickets, makeUser('Mechanic'));
    expect(result.map((t) => t.id)).toEqual([1]);
  });

  it('Manager sees archived tickets assigned to self OR created by self', () => {
    const tickets = [
      makeTicket({ id: 1, archived_at: ARCHIVED_AT, assigned_mechanic_id: ME, created_by_id: OTHER }),
      makeTicket({ id: 2, archived_at: ARCHIVED_AT, assigned_mechanic_id: OTHER, created_by_id: ME }),
      makeTicket({ id: 3, archived_at: ARCHIVED_AT, assigned_mechanic_id: OTHER, created_by_id: OTHER }),
      makeTicket({ id: 4, archived_at: null, assigned_mechanic_id: ME, created_by_id: ME }),
    ];
    const result = filterArchivedForUser(tickets, makeUser('Manager'));
    expect(result.map((t) => t.id)).toEqual([1, 2]);
  });

  it('Secretary sees archived tickets created by self only', () => {
    const tickets = [
      makeTicket({ id: 1, archived_at: ARCHIVED_AT, created_by_id: ME, assigned_mechanic_id: OTHER }),
      makeTicket({ id: 2, archived_at: ARCHIVED_AT, created_by_id: OTHER, assigned_mechanic_id: ME }),
      makeTicket({ id: 3, archived_at: null, created_by_id: ME }),
    ];
    const result = filterArchivedForUser(tickets, makeUser('Secretary'));
    expect(result.map((t) => t.id)).toEqual([1]);
  });
});

describe('formatDateTime', () => {
  it('formats an ISO timestamp as DD/MM/YYYY HH:mm', () => {
    // Construct from local parts so the assertion is timezone-independent.
    const iso = new Date(2026, 5, 18, 9, 5).toISOString();
    expect(formatDateTime(iso)).toBe('18/06/2026 09:05');
  });

  it('returns an em dash for missing or invalid values', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('—');
  });
});
