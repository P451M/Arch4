export const STABLE_GENERATED_AT = "1970-01-01T00:00:00.000Z";

export function generatedAt(): string {
  return process.env.ARCH4_GENERATED_AT ?? STABLE_GENERATED_AT;
}
