import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/auth/dal";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  isValidUsernameFormat,
} from "@/lib/auth/validation";
import { ERROR_CODE, Errors, apiErrorWithHeaders } from "@/lib/errors";
import { AUDIT_ACTION, logAuditAsync } from "@/lib/audit";
import { logger } from "@/lib/logger";

const LOGIN_ATTEMPTS_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

    const rateLimit = checkRateLimit(
      `login:${ipAddress}`,
      LOGIN_ATTEMPTS_LIMIT,
      LOGIN_WINDOW_MS
    );

    if (!rateLimit.allowed) {
      return apiErrorWithHeaders(
        ERROR_CODE.RATE_LIMIT_EXCEEDED,
        "Too many login attempts. Try again later.",
        429,
        undefined,
        { "Retry-After": String(rateLimit.retryAfterSeconds) }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return Errors.missingFields(["username", "password"]);
    }

    if (typeof username !== "string" || typeof password !== "string") {
      return Errors.validation("Invalid input types");
    }

    if (
      username.length < USERNAME_MIN_LENGTH ||
      username.length > USERNAME_MAX_LENGTH ||
      !isValidUsernameFormat(username)
    ) {
      return Errors.invalidCredentials();
    }

    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      return Errors.invalidCredentials();
    }

    const user = await getUserByUsername(username);

    if (!user) {
      logger.warn({ username, ip: ipAddress }, "Failed login attempt - user not found");
      return Errors.invalidCredentials();
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      logger.warn({ username, ip: ipAddress }, "Failed login attempt - invalid password");
      return Errors.invalidCredentials();
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      sessionVersion: user.sessionVersion,
    });

    await createSession(
      { userId: user.id, username: user.username, sessionVersion: user.sessionVersion },
      token
    );

    logAuditAsync({
      userId: user.id,
      action: AUDIT_ACTION.USER_LOGIN,
      metadata: { username: user.username },
      ipAddress: ipAddress,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    return Errors.internal("Login error", error);
  }
}
