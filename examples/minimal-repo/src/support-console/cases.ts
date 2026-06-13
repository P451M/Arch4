export function supportCaseSummary(bookingId: string) {
  return {
    bookingId,
    visibleSections: [
      "timeline",
      "partner-confirmation",
      "payment-status",
      "notifications",
    ],
  };
}
