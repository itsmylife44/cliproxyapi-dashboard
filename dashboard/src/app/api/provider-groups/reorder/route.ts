import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { ReorderProviderGroupsSchema } from "@/lib/validation/schemas";
import { z } from "zod";

export async function PUT(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    const validated = ReorderProviderGroupsSchema.parse(body);

    const groups = await prisma.providerGroup.findMany({
      where: {
        userId: session.userId,
        id: { in: validated.groupIds },
      },
      select: { id: true },
    });

    if (groups.length !== validated.groupIds.length) {
      return Errors.validation("One or more provider groups do not belong to the current user");
    }

    await prisma.$transaction(
      validated.groupIds.map((groupId, index) =>
        prisma.providerGroup.update({
          where: { id: groupId },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Errors.zodValidation(error.issues);
    }
    return Errors.internal("PUT /api/provider-groups/reorder", error);
  }
}
