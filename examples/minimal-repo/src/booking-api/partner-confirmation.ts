export type PartnerConfirmation = {
  status: "confirmed" | "pending" | "failed";
  partnerReference?: string;
};

export function normalizePartnerConfirmation(payload: PartnerConfirmation) {
  if (payload.status === "confirmed" && payload.partnerReference) {
    return {
      customerVisibleState: "confirmed",
      partnerReference: payload.partnerReference,
    };
  }
  return { customerVisibleState: "pending_partner_confirmation" };
}
