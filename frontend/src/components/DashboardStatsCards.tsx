import { formatMinutes } from '../utils/duration';

interface Props {
  pending: number;
  inProgress: number;
  completed: number;
  // When provided, an extra card shows the average completion time. Pass null to
  // render the card with a Hebrew "unavailable" value; omit it entirely to hide
  // the card (e.g. the Secretary dashboard, which has no manager-only metric).
  avgCompletionMinutes?: number | null;
}

interface Card {
  key: string;
  label: string;
  value: string;
  icon: string;
  accent: string;
}

// Big numeric summary cards for the top of a dashboard. Used by both the Manager
// dashboard (with average completion time) and the Secretary dashboard (status
// totals only). Purely presentational.
export default function DashboardStatsCards({
  pending,
  inProgress,
  completed,
  avgCompletionMinutes,
}: Props) {
  const cards: Card[] = [
    { key: 'pending', label: 'ממתינות לטיפול', value: String(pending), icon: '⏳', accent: 'text-amber-600' },
    { key: 'in-progress', label: 'בטיפול', value: String(inProgress), icon: '⚙️', accent: 'text-orange-600' },
    { key: 'completed', label: 'הושלמו', value: String(completed), icon: '✅', accent: 'text-green-600' },
  ];

  if (avgCompletionMinutes !== undefined) {
    cards.push({
      key: 'avg',
      label: 'זמן טיפול ממוצע',
      value: formatMinutes(avgCompletionMinutes),
      icon: '⏱️',
      accent: 'text-gray-700',
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.key}
          aria-label={card.label}
          className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <span className="text-sm font-medium text-gray-500">
            {card.icon} {card.label}
          </span>
          <span className={`text-2xl font-bold ${card.accent}`}>{card.value}</span>
        </div>
      ))}
    </div>
  );
}
