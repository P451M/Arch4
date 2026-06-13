import { assertOfferFreshness } from "./quote-validator.js";
import { normalizePartnerConfirmation } from "./partner-confirmation.js";

export async function bookTrip(offerUpdatedAt: Date) {
  assertOfferFreshness(offerUpdatedAt);
  const confirmation = normalizePartnerConfirmation({
    status: "confirmed",
    partnerReference: "PNR-123",
  });
  return {
    state: "confirmed",
    confirmation,
    events: ["booking.confirmed"],
  };
}
