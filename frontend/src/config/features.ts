// Frontend feature flags. These let a garage toggle optional behaviour without
// code changes elsewhere. Keep the shape flat and serialisable.
export interface FeatureFlags {
  // When true, mechanics may open new work tickets from the frontend.
  // The SRS marks mechanic ticket creation as optional ("לפי הגדרת המוסך"),
  // so it is disabled by default and gates both navigation and the route guard.
  enableMechanicTicketCreation: boolean;
}

export const features: FeatureFlags = {
  enableMechanicTicketCreation: false,
};
