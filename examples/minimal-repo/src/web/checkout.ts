export type CheckoutRequest = {
  offerId: string;
  travelerId: string;
  paymentToken: string;
};

export function submitCheckout(request: CheckoutRequest) {
  return {
    path: "/api/bookings",
    body: request,
  };
}
