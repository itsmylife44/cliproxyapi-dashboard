import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import {
  MANAGEMENT_BASE_URL,
  MANAGEMENT_API_KEY,
  fetchWithTimeout,
} from "@/lib/providers/management-api";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetchWithTimeout(`${MANAGEMENT_BASE_URL}/config`, {
      headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
    });

    if (!res.ok) {
      return NextResponse.json({ incognitoBrowser: false });
    }

    const data = await res.json();
    return NextResponse.json({
      incognitoBrowser: Boolean(data["incognito-browser"]),
    });
  } catch {
    return NextResponse.json({ incognitoBrowser: false });
  }
}
