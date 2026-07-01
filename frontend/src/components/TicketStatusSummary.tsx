import DashboardStatsCards from './DashboardStatsCards';

interface Props {
  pending: number;
  inProgress: number;
  completed: number;
}

// Section wrapper around the status summary cards (FR-6.2 / Secretary general
// summary). Shared by the Manager and Secretary dashboards. The total is shown
// alongside the heading so an at-a-glance count is always visible. The average
// completion time is no longer displayed on the dashboard (product decision).
export default function TicketStatusSummary({ pending, inProgress, completed }: Props) {
  const total = pending + inProgress + completed;

  return (
    <section className="flex flex-col gap-3" aria-label="סיכום סטטוס קריאות">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">סיכום סטטוס קריאות</h2>
        <span className="text-sm text-gray-500">סך הכל {total} קריאות</span>
      </div>
      <DashboardStatsCards pending={pending} inProgress={inProgress} completed={completed} />
    </section>
  );
}
