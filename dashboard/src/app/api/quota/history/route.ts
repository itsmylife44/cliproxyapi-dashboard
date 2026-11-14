import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { Errors } from "@/lib/errors";
import { getAccountQuotaHistory, getAccountsQuotaHistory } from "@/lib/quota/quota-history";

export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

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
      return NextResponse.json({ histories });
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
    return NextResponse.json(history);
  } catch (error) {
    return Errors.internal("Failed to load quota history", error);
  }
}
