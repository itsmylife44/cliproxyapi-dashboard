import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { verifyToken, type SessionPayload } from "./jwt";

const SESSION_COOKIE_NAME = "session";

export const verifySession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  return payload;
});

export async function createSession(_payload: SessionPayload, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const cookieStore = await cookies();

  const dashboardUrl = process.env.DASHBOARD_URL || "";
  const isHttps = dashboardUrl.startsWith("https://");
  const useSecureCookie = process.env.NODE_ENV === "production" && isHttps;

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: useSecureCookie,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
