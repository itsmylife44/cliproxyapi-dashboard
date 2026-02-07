/**
 * Share code generation and validation utilities for config sharing.
 * Uses cryptographically secure random generation with base32-like alphabet
 * (excludes ambiguous characters: 0, O, 1, I, l)
 */

/**
 * Alphabet for share codes: excludes 0/O, 1/I/l for clarity
 * 32 characters total for even distribution with 8-char codes
 */
const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" as const;

/**
 * Regex pattern for valid share code format: XXXX-XXXX
 * Validates characters and hyphen placement
 */
const SHARE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/**
 * Generate a cryptographically secure share code.
 *
 * @returns Share code in format XXXX-XXXX (8 alphanumeric chars + 1 hyphen)
 *
 * @example
 * const code = generateShareCode();
 * // Returns something like: "XKFA-9B2M"
 */
export function generateShareCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  let code = "";
  for (let i = 0; i < 8; i++) {
    const index = bytes[i] % SHARE_CODE_ALPHABET.length;
    code += SHARE_CODE_ALPHABET[index];
  }

  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

/**
 * Validate share code format.
 *
 * @param code - The share code to validate
 * @returns true if code matches XXXX-XXXX pattern with valid characters
 *
 * @example
 * validateShareCodeFormat("XKFA-9B2M") // true
 * validateShareCodeFormat("0OIl-0000") // false (invalid characters)
 * validateShareCodeFormat("XKFA9B2M")  // false (missing hyphen)
 */
export function validateShareCodeFormat(code: string): boolean {
  return SHARE_CODE_PATTERN.test(code);
}

/**
 * Normalize a share code to standard format.
 *
 * @param input - Raw input (may have whitespace, lowercase, missing hyphen)
 * @returns Normalized code in format XXXX-XXXX, or input if malformed
 *
 * @example
 * normalizeShareCode("  xkfa9b2m  ") // "XKFA-9B2M"
 * normalizeShareCode("XKFA-9B2M")   // "XKFA-9B2M"
 */
export function normalizeShareCode(input: string): string {
  const cleaned = input.trim().toUpperCase();
  const withoutHyphen = cleaned.replace(/-/g, "");

  if (withoutHyphen.length === 8) {
    return `${withoutHyphen.slice(0, 4)}-${withoutHyphen.slice(4, 8)}`;
  }

  if (validateShareCodeFormat(cleaned)) {
    return cleaned;
  }

  return cleaned;
}
