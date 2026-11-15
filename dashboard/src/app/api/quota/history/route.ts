import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import {
  getAccountQuotaHistory,
  getAccountsQuotaHistory,
  redactQuotaHistoryValuation,
  type AccountQuotaHistoryResponse,
} from "@/lib/quota/quota-history";

export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });
  const isAdmin = Boolean(user?.isAdmin);

  const authIndicesParam = request.nextUrl.searchParams.get("authIndices")?.trim();
  if (authIndicesParam) {
    const indices = Array.from(
      new Set(
        authIndicesParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    try {
      const histories = await getAccountsQuotaHistory(indices);
      if (isAdmin) {
        return NextResponse.json({ histories });
      }
      const redacted: Record<string, AccountQuotaHistoryResponse> = {};
      for (const [id, history] of Object.entries(histories)) {
        redacted[id] = redactQuotaHistoryValuation(history);
      }
      return NextResponse.json({ histories: redacted });
    } catch (error) {
      return Errors.internal("Failed to load quota histories", error);
    }
  }

  const authIndex = request.nextUrl.searchParams.get("authIndex")?.trim();
  if (!authIndex) {
    return Errors.validation("authIndex is required");
  }

  try {
    const history = await getAccountQuotaHistory(authIndex);
    return NextResponse.json(isAdmin ? history : redactQuotaHistoryValuation(history));
  } catch (error) {
    return Errors.internal("Failed to load quota history", error);
  }
}
