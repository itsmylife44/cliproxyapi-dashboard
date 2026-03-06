import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { verifyToken, type SessionPayload } from "./jwt";
import { prisma } from "@/lib/db";

const SESSION_COOKIE_NAME = "session";

export const verifySession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      sessionVersion: true,
    },
  });

  if (!user) {
    return null;
  }

  if (user.sessionVersion !== payload.sessionVersion) {
    return null;
  }

  return {
    userId: user.id,
    username: user.username,
    sessionVersion: user.sessionVersion,
  };
});

export async function createSession(_payload: SessionPayload, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const cookieStore = await cookies();

  // Determine secure flag from actual request protocol.
  // When behind a reverse proxy (Caddy, nginx), X-Forwarded-Proto tells us the real protocol.
  // When the header is absent (direct access, no proxy), fall back to NODE_ENV
  // so local HTTP dev works (NODE_ENV=development) while production defaults to secure.
  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto");
  const isSecure = proto ? proto === "https" : process.env.NODE_ENV === "production";

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
