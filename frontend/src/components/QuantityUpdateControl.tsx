import { useState, type FormEvent } from 'react';
import type { Part } from '../types';

interface Props {
  part: Part;
  submitting: boolean;
  error?: string | null;
  onSubmit: (quantity: number) => void;
  onCancel: () => void;
}

// Compact quantity-only update for a single part (FR-7.1 / FR-7.5). A stepper
// plus a free input so staff can both nudge (+/-) and type an exact count. The
// quantity must be a non-negative integer; the form blocks submit otherwise with
// an inline Hebrew message.
export default function QuantityUpdateControl({
  part,
  submitting,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [value, setValue] = useState(String(part.quantity_current));
  const [validationError, setValidationError] = useState<string | null>(null);

  const parsed = Number(value.trim());
  const isValid = value.trim() !== '' && Number.isInteger(parsed) && parsed >= 0;

  const step = (delta: number) => {
    const next = Math.max(0, (Number.isInteger(parsed) ? parsed : 0) + delta);
    setValue(String(next));
    setValidationError(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setValidationError('הכמות חייבת להיות מספר שלם אי-שלילי');
      return;
    }
    onSubmit(parsed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      aria-label={`עדכון כמות ${part.part_name}`}
    >
      <h3 className="text-lg font-bold text-gray-800">עדכון כמות — {part.part_name}</h3>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="הפחת כמות"
          onClick={() => step(-1)}
          disabled={submitting}
          className="h-9 w-9 rounded-md border border-gray-300 text-lg font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          −
        </button>
        <input
          aria-label="כמות במלאי"
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setValidationError(null);
          }}
          className="w-24 rounded-md border border-gray-300 px-3 py-2 text-center text-sm focus:border-amber-500 focus:outline-none"
        />
        <button
          type="button"
          aria-label="הוסף כמות"
          onClick={() => step(1)}
          disabled={submitting}
          className="h-9 w-9 rounded-md border border-gray-300 text-lg font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          +
        </button>
      </div>

      {validationError && (
        <p role="alert" className="text-sm text-red-600">
          {validationError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-orange-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
        >
          {submitting ? 'שומר...' : 'שמור כמות'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
