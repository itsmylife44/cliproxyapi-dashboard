import "server-only";
import { cookies } from "next/headers";
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

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
