import type { Role } from '../types';
import { ROLE_LABELS } from '../config/roles';

// Per-role badge colours, kept within the GarageClick orange/amber family with a
// neutral grey for mechanics so the three roles are visually distinct.
const STYLES: Record<Role, string> = {
  Manager: 'bg-orange-200 text-orange-900',
  Secretary: 'bg-amber-100 text-amber-800',
  Mechanic: 'bg-gray-100 text-gray-700',
};

interface Props {
  role: Role;
}

// Small pill showing the Hebrew role label (shared source: config/roles).
export default function UserRoleBadge({ role }: Props) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
