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
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Invalid input types" },
        { status: 400 }
      );
    }

    if (
      username.length < USERNAME_MIN_LENGTH ||
      username.length > USERNAME_MAX_LENGTH ||
      !isValidUsernameFormat(username)
    ) {
      return NextResponse.json(
        {
          error: `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} chars and contain only letters, numbers, _ or -`,
        },
        { status: 400 }
      );
    }

    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    let user: { id: string; username: string } | null = null;

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
          return NextResponse.json(
            { error: "Setup already completed" },
            { status: 400 }
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
    });

    await createSession(
      { userId: user.id, username: user.username },
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
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const userCount = await getUserCount();
    
    return NextResponse.json({
      setupRequired: userCount === 0,
    });
  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
