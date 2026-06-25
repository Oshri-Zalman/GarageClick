// A small badge marking a ticket as closed and kept in history (Stage 10).
// Shown on every card in the ticket archive ("ארכיון כרטיסים") alongside the
// original status badge, so a closed ticket reads as archived rather than active.
export default function TicketHistoryStatusBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
      title="הכרטיס נסגר ונשמר בהיסטוריה"
    >
      🗄️ בארכיון
    </span>
  );
}
