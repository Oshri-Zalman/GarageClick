interface Props {
  quantity: number;
}

// Stock status pill (FR-7). A part is out of stock when quantity_current is 0
// (SRS §7.2), otherwise it is available. Colours follow the app's amber/green
// convention used by the ticket StatusBadge.
export default function PartStatusBadge({ quantity }: Props) {
  const available = quantity > 0;
  const className = available
    ? 'bg-green-100 text-green-800'
    : 'bg-red-100 text-red-800';
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {available ? 'זמין' : 'אזל מהמלאי'}
    </span>
  );
}
