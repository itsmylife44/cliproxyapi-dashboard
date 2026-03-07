import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";
import { Errors, apiSuccess } from "@/lib/errors";
import { ConfirmActionSchema } from "@/lib/validation/schemas";

const execFileAsync = promisify(execFile);

const CONTAINER_NAME = "cliproxyapi";

export async function POST(request: NextRequest) {
  const session = await verifySession();

  if (!session) {
    return Errors.unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return Errors.forbidden();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    const result = ConfirmActionSchema.safeParse(body);

    if (!result.success) {
      return Errors.zodValidation(result.error.issues);
    }

    await execFileAsync("docker", ["restart", CONTAINER_NAME]);

    return apiSuccess({ message: "Restart completed" });
  } catch (error) {
    return Errors.internal("Restart endpoint error", error);
  }
}
