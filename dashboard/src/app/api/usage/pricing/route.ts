import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { Errors } from "@/lib/errors";
import { getLiveModelPricing } from "@/lib/model-pricing-catalog";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const pricing = await getLiveModelPricing();
  const hasEntries = Object.keys(pricing).length > 0;
  return NextResponse.json(
    { pricing },
    {
      headers: {
        "Cache-Control": hasEntries ? "private, max-age=300" : "no-store",
      },
    }
  );
}
