export function cancelBooking(policyAllowsRefund: boolean) {
  return {
    state: "cancelled",
    refundRequested: policyAllowsRefund,
    events: ["booking.cancelled"],
  };
}
