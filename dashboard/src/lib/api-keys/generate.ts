import "server-only";
import { randomBytes } from "crypto";

/**
 * Generate a secure API key in the format: sk-{64 lowercase hex chars}
 * Uses Node.js crypto.randomBytes for server-side generation only.
 * @returns A securely generated API key
 */
export function generateApiKey(): string {
  const bytes = randomBytes(32);
  return `sk-${bytes.toString("hex")}`;
}
