interface Props {
  message?: string;
}

export default function LoadingSpinner({ message = 'טוען...' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
        role="status"
        aria-label={message}
      />
      <span className="text-sm text-gray-500">{message}</span>
    </div>
  );
}
