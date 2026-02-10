import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;

export interface SessionPayload extends Record<string, unknown> {
  userId: string;
  username: string;
  sessionVersion: number;
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
