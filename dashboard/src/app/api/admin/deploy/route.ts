import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const WEBHOOK_HOST = process.env.WEBHOOK_HOST || "http://localhost:9000";
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || "";

async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  return user?.isAdmin ?? false;
}

export async function POST(request: Request) {
  try {
    const session = await verifySession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.userId))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (!DEPLOY_SECRET) {
      return NextResponse.json(
        { error: "DEPLOY_SECRET not configured on server" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const noCache = body.noCache === true;
    
    const endpoint = noCache ? "deploy-dashboard-nocache" : "deploy-dashboard";
    
    const response = await fetch(`${WEBHOOK_HOST}/hooks/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Deploy-Token": DEPLOY_SECRET,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Webhook failed: ${text}` },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: noCache ? "Full rebuild started" : "Quick update started",
    });
  } catch (error) {
    console.error("Deploy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Deploy failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await verifySession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.userId))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (!DEPLOY_SECRET) {
      return NextResponse.json(
        { error: "DEPLOY_SECRET not configured" },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "status";
    
    const endpoint = type === "log" ? "deploy-log" : "deploy-status";
    
    const response = await fetch(`${WEBHOOK_HOST}/hooks/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Deploy-Token": DEPLOY_SECRET,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ status: "idle", message: "No deployment in progress" });
      }
      return NextResponse.json(
        { error: "Failed to get deploy status" },
        { status: response.status }
      );
    }

    const text = await response.text();
    
    if (type === "log") {
      return NextResponse.json({ log: text });
    }
    
    try {
      const status = JSON.parse(text);
      return NextResponse.json(status);
    } catch {
      return NextResponse.json({ status: "idle", message: "No deployment in progress" });
    }
  } catch (error) {
    console.error("Deploy status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 }
    );
  }
}
