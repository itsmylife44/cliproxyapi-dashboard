import "server-only";
import { SignJWT, jwtVerify } from "jose";

function getJwtSecret(): Uint8Array {
  const rawSecret = process.env.JWT_SECRET;

  if (!rawSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  if (rawSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }

  return new TextEncoder().encode(rawSecret);
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface SessionPayload extends Record<string, unknown> {
  userId: string;
  username: string;
}

export async function signToken(payload: SessionPayload): Promise<string> {
  const jwtSecret = getJwtSecret();

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("cliproxyapi-dashboard")
    .setAudience("cliproxyapi-dashboard")
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(jwtSecret);
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const jwtSecret = getJwtSecret();

    const { payload } = await jwtVerify(token, jwtSecret, {
      issuer: "cliproxyapi-dashboard",
      audience: "cliproxyapi-dashboard",
    });

    return payload as SessionPayload;
  } catch {
    return null;
  }
}
