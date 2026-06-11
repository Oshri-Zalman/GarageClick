// Shared search/filter shape for the parts inventory screen. Kept in its own
// module (not the component file) so both the filters component and the page can
// import it without tripping the react-refresh "components only" rule.
export interface PartFilters {
  manufacturer: string;
  model: string;
  partName: string;
  partCode: string;
}

export const EMPTY_FILTERS: PartFilters = {
  manufacturer: '',
  model: '',
  partName: '',
  partCode: '',
};
