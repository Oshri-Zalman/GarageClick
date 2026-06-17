// A part is "universal" (fits all vehicles) when it has no make/model/year
// compatibility — all three are null. The backend treats each null dimension as
// a wildcard in GET /api/parts/compatible, so such a part matches every vehicle.
export function isUniversalPart(part: {
  manufacturer: string | null;
  model: string | null;
  year_start: number | null;
}): boolean {
  return part.manufacturer == null && part.model == null && part.year_start == null;
}
