export function assertOfferFreshness(offerUpdatedAt: Date, now = new Date()) {
  const maxAgeMs = 5 * 60 * 1000;
  if (now.getTime() - offerUpdatedAt.getTime() > maxAgeMs) {
    throw new Error("Selected offer is no longer fresh enough for checkout.");
  }
}
