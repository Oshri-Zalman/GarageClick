// Formatting helpers for the durations the dashboard reports return in minutes.

// Placeholder shown wherever a duration is not available (the backend returns
// null when no completed ticket has both a start and completion timestamp).
export const DURATION_UNAVAILABLE = 'לא זמין';

// Formats a duration given in minutes into a short Hebrew string, e.g.
// 270 → "4 שעות ו-30 דקות", 45 → "45 דקות", 120 → "שעתיים".
// Returns DURATION_UNAVAILABLE for null/undefined/NaN.
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return DURATION_UNAVAILABLE;

  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  const hoursLabel = formatHours(hours);
  const minsLabel = mins > 0 ? `${mins} דקות` : '';

  if (hoursLabel && minsLabel) return `${hoursLabel} ו-${minsLabel}`;
  if (hoursLabel) return hoursLabel;
  return minsLabel || '0 דקות';
}

function formatHours(hours: number): string {
  if (hours === 0) return '';
  if (hours === 1) return 'שעה';
  if (hours === 2) return 'שעתיים';
  return `${hours} שעות`;
}
