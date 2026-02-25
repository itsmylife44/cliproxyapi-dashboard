import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { UpdateProviderGroupSchema } from "@/lib/validation/schemas";
import { z } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    const validated = UpdateProviderGroupSchema.parse(body);

    const existingGroup = await prisma.providerGroup.findUnique({
      where: { id },
    });

    if (!existingGroup) {
      return Errors.notFound("Provider group");
    }

    if (existingGroup.userId !== session.userId) {
      return Errors.forbidden();
    }

    if (validated.name && validated.name !== existingGroup.name) {
      const nameConflict = await prisma.providerGroup.findFirst({
        where: {
          userId: session.userId,
          name: validated.name,
          id: { not: id },
        },
        select: { id: true },
      });

      if (nameConflict) {
        return Errors.conflict("Provider group name already exists");
      }
    }

    const group = await prisma.providerGroup.update({
      where: { id },
      data: {
        name: validated.name,
        color: validated.color,
        isActive: validated.isActive,
      },
    });

    const action =
      validated.isActive !== undefined && validated.isActive !== existingGroup.isActive
        ? AUDIT_ACTION.PROVIDER_GROUP_TOGGLED
        : AUDIT_ACTION.PROVIDER_GROUP_UPDATED;

    logAuditAsync({
      userId: session.userId,
      action,
      target: group.id,
      metadata: {
        updatedFields: Object.keys(validated),
        before: {
          name: existingGroup.name,
          color: existingGroup.color,
          isActive: existingGroup.isActive,
        },
        after: {
          name: group.name,
          color: group.color,
          isActive: group.isActive,
        },
      },
      ipAddress: extractIpAddress(request),
    });

    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Errors.zodValidation(error.issues);
    }
    return Errors.internal("PATCH /api/provider-groups/[id]", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const existingGroup = await prisma.providerGroup.findUnique({
      where: { id },
    });

    if (!existingGroup) {
      return Errors.notFound("Provider group");
    }

    if (existingGroup.userId !== session.userId) {
      return Errors.forbidden();
    }

    await prisma.providerGroup.delete({
      where: { id },
    });

    logAuditAsync({
      userId: session.userId,
      action: AUDIT_ACTION.PROVIDER_GROUP_DELETED,
      target: existingGroup.id,
      metadata: {
        name: existingGroup.name,
      },
      ipAddress: extractIpAddress(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return Errors.internal("DELETE /api/provider-groups/[id]", error);
  }
}
