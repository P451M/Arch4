export function authorizePayment(amountCents: number) {
  return {
    amountCents,
    status: "authorized",
    provider: "external-card-processor",
  };
}
