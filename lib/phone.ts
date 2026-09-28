export function normalizeOptionalPhone(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return undefined;

  return `+${digits}`;
}
