import { NextRequest, NextResponse } from "next/server";
import { getUserCount } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { createSession } from "@/lib/auth/session";
import { Prisma } from "@/generated/prisma/client";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  isValidUsernameFormat,
} from "@/lib/auth/validation";
import { prisma } from "@/lib/db";
import { ERROR_CODE, Errors, apiError } from "@/lib/errors";

const MAX_SETUP_RETRIES = 5;

class SetupAlreadyCompletedError extends Error {
  constructor() {
    super("Setup already completed");
    this.name = "SetupAlreadyCompletedError";
  }
}

function isSerializationConflict(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function POST(request: NextRequest) {
  try {
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
      return apiError(
        ERROR_CODE.VALIDATION_INVALID_FORMAT,
        `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} chars and contain only letters, numbers, _ or -`,
        400
      );
    }

    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      return apiError(
        ERROR_CODE.VALIDATION_INVALID_FORMAT,
        `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
        400
      );
    }

    const passwordHash = await hashPassword(password);

    let user: { id: string; username: string; sessionVersion: number } | null = null;

    for (let attempt = 0; attempt < MAX_SETUP_RETRIES; attempt++) {
      try {
        user = await prisma.$transaction(
          async (tx) => {
            const userCount = await tx.user.count();

            if (userCount > 0) {
              throw new SetupAlreadyCompletedError();
            }

            return tx.user.create({
              data: {
                username,
                passwordHash,
                isAdmin: true,
              },
              select: {
                id: true,
                username: true,
                sessionVersion: true,
              },
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          }
        );

        break;
      } catch (error) {
        if (error instanceof SetupAlreadyCompletedError) {
          return apiError(
            ERROR_CODE.SETUP_ALREADY_COMPLETED,
            "Setup already completed",
            400
          );
        }

        if (isSerializationConflict(error) && attempt < MAX_SETUP_RETRIES - 1) {
          const backoffMs = Math.pow(2, attempt) * 100;
          await wait(backoffMs);
          continue;
        }

        throw error;
      }
    }

    if (!user) {
      throw new Error("Setup failed after maximum retries");
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

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return Errors.internal("Setup error", error);
  }
}

export async function GET() {
  try {
    const userCount = await getUserCount();

    return NextResponse.json({
      data: { setupRequired: userCount === 0 },
    });
  } catch (error) {
    return Errors.internal("Setup check error", error);
  }
}
