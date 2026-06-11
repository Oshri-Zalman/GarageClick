import type { CustomerDetail } from '../types';

interface Props {
  customer: CustomerDetail;
  canManage: boolean;
  onEdit: () => void;
}

// Customer details header card (FR-1): name + phone, with an edit action when the
// role may manage customers. The vehicle list is rendered separately.
export default function CustomerCard({ customer, canManage, onEdit }: Props) {
  return (
    <section aria-label="פרטי לקוח" className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{customer.full_name}</h2>
          <p className="mt-1 text-sm text-gray-600">
            ☎️ <span dir="ltr">{customer.phone_number}</span>
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-orange-300 px-3 py-1.5 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50"
          >
            ✏️ ערוך לקוח
          </button>
        )}
      </div>
    </section>
  );
}
