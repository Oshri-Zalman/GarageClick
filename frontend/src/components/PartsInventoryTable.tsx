import type { Part } from '../types';
import { isUniversalPart } from '../utils/parts';
import PartStatusBadge from './PartStatusBadge';

interface Props {
  parts: Part[];
  canManage: boolean;
  onEdit: (part: Part) => void;
  onUpdateQuantity: (part: Part) => void;
}

// Inventory listing table (FR-7). One row per part with name, SKU, manufacturer,
// model, year-start, current quantity and stock status. Manager/Secretary get
// per-row edit and quantity-update actions.
export default function PartsInventoryTable({ parts, canManage, onEdit, onUpdateQuantity }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-right text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-amber-50 text-gray-700">
            <th className="px-3 py-2 font-semibold">שם חלף</th>
            <th className="px-3 py-2 font-semibold">מק&quot;ט</th>
            <th className="px-3 py-2 font-semibold">יצרן</th>
            <th className="px-3 py-2 font-semibold">דגם</th>
            <th className="px-3 py-2 font-semibold">שנת התחלה</th>
            <th className="px-3 py-2 font-semibold">כמות</th>
            <th className="px-3 py-2 font-semibold">סטטוס</th>
            {canManage && <th className="px-3 py-2 font-semibold">פעולות</th>}
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => {
            const universal = isUniversalPart(part);
            return (
            <tr key={part.id} className="border-b border-gray-100 last:border-0 hover:bg-amber-50/50">
              <td className="px-3 py-2 font-semibold text-gray-800">{part.part_name}</td>
              <td className="px-3 py-2 text-gray-600">{part.part_code}</td>
              {universal ? (
                <td className="px-3 py-2 font-semibold text-amber-700" colSpan={3}>
                  כל הרכבים
                </td>
              ) : (
                <>
                  <td className="px-3 py-2 text-gray-600">{part.manufacturer ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{part.model ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{part.year_start ?? '—'}</td>
                </>
              )}
              <td className="px-3 py-2 font-semibold text-gray-800">{part.quantity_current}</td>
              <td className="px-3 py-2">
                <PartStatusBadge quantity={part.quantity_current} />
              </td>
              {canManage && (
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(part)}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      ✏️ ערוך
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(part)}
                      className="rounded-md border border-orange-300 px-2.5 py-1 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-50"
                    >
                      🔢 עדכן כמות
                    </button>
                  </div>
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
