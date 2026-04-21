/**
 * Masks the local part of an email address while preserving the domain so
 * account identities are not leaked into logs, DOM, or search haystacks.
 * Returns `unknownLabel` when the input is missing or not a usable address.
 */
export function maskEmail(email: unknown, unknownLabel = "unknown"): string {
  if (typeof email !== "string") return unknownLabel;
  const trimmed = email.trim();
  if (trimmed === "") return unknownLabel;

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return trimmed;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const maskedLocal = local.length <= 3 ? `${local}***` : `${local.slice(0, 3)}***`;
  return `${maskedLocal}@${domain}`;
}
