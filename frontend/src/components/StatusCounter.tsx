interface Props {
  count: number;
}

// Small pill showing how many tickets sit in a column. The accessible label
// embeds the count so it can be asserted unambiguously in tests.
export default function StatusCounter({ count }: Props) {
  return (
    <span
      aria-label={`${count} קריאות`}
      className="inline-flex min-w-6 items-center justify-center rounded-full bg-gray-300 px-2 text-xs font-semibold text-gray-700"
    >
      {count}
    </span>
  );
}
