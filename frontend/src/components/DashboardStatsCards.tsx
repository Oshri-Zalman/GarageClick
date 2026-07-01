import { STATUS_ACCENT_STYLES } from '../config/ticketStatus';

interface Props {
  pending: number;
  inProgress: number;
  completed: number;
}

interface Card {
  key: string;
  label: string;
  value: string;
  icon: string;
  accent: string;
}

// Big numeric summary cards for the top of a dashboard. Shared by the Manager
// and Secretary dashboards (status totals only). The average completion time is
// intentionally NOT shown here — the dashboard does not display it anywhere
// (product decision). Colors follow the shared status palette (Pending=red,
// In Progress=yellow, Completed=green). Purely presentational.
export default function DashboardStatsCards({ pending, inProgress, completed }: Props) {
  const cards: Card[] = [
    { key: 'pending', label: 'ממתינות לטיפול', value: String(pending), icon: '⏳', accent: STATUS_ACCENT_STYLES.Pending },
    { key: 'in-progress', label: 'בטיפול', value: String(inProgress), icon: '⚙️', accent: STATUS_ACCENT_STYLES['In Progress'] },
    { key: 'completed', label: 'הושלמו', value: String(completed), icon: '✅', accent: STATUS_ACCENT_STYLES.Completed },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
