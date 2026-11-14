import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { Errors } from "@/lib/errors";
import { getMergedModelPricing } from "@/lib/model-pricing-catalog";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const pricing = await getMergedModelPricing();
  return NextResponse.json(
    { pricing },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}
