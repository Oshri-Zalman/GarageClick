interface Props {
  active: boolean;
}

// Active/inactive pill for a user row. Active is green; inactive is muted grey so
// deactivated accounts read as "switched off" at a glance.
export default function UserStatusBadge({ active }: Props) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {active ? 'פעיל' : 'מושבת'}
    </span>
  );
}
