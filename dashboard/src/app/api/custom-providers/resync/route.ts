import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { resyncCustomProviders } from "@/lib/providers/resync";
import { Errors } from "@/lib/errors";

export async function POST() {
  const session = await verifySession();
  if (!session) return Errors.unauthorized();

  const results = await resyncCustomProviders(session.userId);

  const syncedCount = results.filter(r => r.status === "ok").length;
  const skippedCount = results.filter(r => r.status === "skipped").length;
  const failedCount = results.filter(r => r.status === "failed").length;
  const allOk = failedCount === 0;

  return NextResponse.json(
    { results, syncedCount, skippedCount, failedCount },
    { status: allOk ? 200 : 207 }
  );
}
