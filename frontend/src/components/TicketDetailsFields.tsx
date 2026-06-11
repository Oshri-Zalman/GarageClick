import type { Mechanic, User } from '../types';

export interface TicketDetailsValues {
  description: string;
  // The selected mechanic id as a string ('' when nothing is chosen). Ignored
  // for the Mechanic role, who is always assigned to themselves.
  assignedMechanicId: string;
}

export type TicketDetailsField = 'description' | 'assignedMechanicId';

interface Props {
  user: User;
  mechanics: Mechanic[];
  values: TicketDetailsValues;
  errors: Partial<Record<'description' | 'assignedMechanicId', string>>;
  onChange: (field: TicketDetailsField, value: string) => void;
}

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none';

// The shared lower half of both ticket forms: who handles the job, the issue
// description, and a parts placeholder. The mechanic
// assignment honours the role rules in FR-2:
//  • Manager / Secretary pick the assigned mechanic from a dropdown.
//  • A Mechanic is auto-assigned to themselves and sees no dropdown at all.
export default function TicketDetailsFields({ user, mechanics, values, errors, onChange }: Props) {
  const isMechanic = user.role === 'Mechanic';

  return (
    <div className="flex flex-col gap-4">
      {isMechanic ? (
        <div>
          <span className="mb-1 block text-sm font-semibold text-gray-700">עובד מטפל</span>
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="auto-assigned-mechanic">
            {user.full_name ?? user.username} (אתה)
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="assigned-mechanic" className="mb-1 block text-sm font-semibold text-gray-700">
            עובד מטפל
          </label>
          <select
            id="assigned-mechanic"
            value={values.assignedMechanicId}
            onChange={(e) => onChange('assignedMechanicId', e.target.value)}
            className={fieldClass}
          >
            <option value="">בחר עובד מטפל...</option>
            {mechanics.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.name}
              </option>
            ))}
          </select>
          {errors.assignedMechanicId && (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {errors.assignedMechanicId}
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-semibold text-gray-700">
          תיאור התקלה
        </label>
        <textarea
          id="description"
          value={values.description}
          onChange={(e) => onChange('description', e.target.value)}
          rows={3}
          placeholder="תאר את התקלה או הטיפול הנדרש"
          className={fieldClass}
        />
        {errors.description && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errors.description}
          </p>
        )}
      </div>

      {/* Parts selection is intentionally out of scope for Stage 4 — it arrives
          with full inventory management in the next stage. */}
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
        🔩 בחירת חלפים תתווסף בשלב הבא (ניהול מלאי).
      </div>
    </div>
  );
}
