// A small status pill marking a ticket as closed and kept in history (Stage 10).
// Shown on every card in the ticket archive ("ארכיון כרטיסים") INSTEAD of the
// "הושלם" status badge — every archived ticket is already closed, so "בארכיון"
// is the only meaningful state to surface there. Styled in a warm amber/orange
// tone to fit the GarageClick palette while staying visually a status pill.
export default function TicketHistoryStatusBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
      title="הכרטיס נסגר ונשמר בהיסטוריה"
    >
      🗄️ בארכיון
    </span>
  );
}
