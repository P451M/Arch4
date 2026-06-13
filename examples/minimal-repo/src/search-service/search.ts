export function searchTrips(query: {
  destination: string;
  departureDate: string;
}) {
  return {
    cacheKey: `${query.destination}:${query.departureDate}`,
    partnerTypes: ["airline", "hotel"],
  };
}
