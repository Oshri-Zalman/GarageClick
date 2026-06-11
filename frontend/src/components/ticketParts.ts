import type { SelectedPart } from '../types';

// The user's parts choice for a ticket. `selected` maps a part_id to the chosen
// quantity; `noParts` is the "אחר / ללא חלפים" option (a ticket with no
// inventory parts — nothing is deducted). The two are mutually exclusive: picking
// a part clears `noParts`, and picking "אחר" clears the selection (FR-7.3).
export interface PartsSelectionState {
  selected: Record<number, number>;
  noParts: boolean;
}

export const emptyPartsSelection: PartsSelectionState = { selected: {}, noParts: false };

// FR-7.2/7.3: before submit the user must either pick at least one available
// part or explicitly choose "אחר / ללא חלפים". Returns a Hebrew message when
// neither is true, or null when the choice is valid.
export function validatePartsSelection(state: PartsSelectionState): string | null {
  if (state.noParts) return null;
  if (Object.keys(state.selected).length === 0) {
    return 'יש לבחור חלף תואם או לבחור "אחר / ללא חלפים"';
  }
  return null;
}

// Builds the `parts` array for POST /api/tickets. "אחר / ללא חלפים" sends an
// empty list (no inventory deduction); otherwise one { part_id, quantity } per
// selected part.
export function buildPartsPayload(state: PartsSelectionState): SelectedPart[] {
  if (state.noParts) return [];
  return Object.entries(state.selected).map(([partId, quantity]) => ({
    part_id: Number(partId),
    quantity,
  }));
}
