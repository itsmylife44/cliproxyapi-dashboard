import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const BACKEND_API_URL =
  process.env.CLIPROXYAPI_MANAGEMENT_URL ||
  "http://cliproxyapi:8317/v0/management";
const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;

const ALLOWED_HOST = (() => {
  try {
    return new URL(BACKEND_API_URL).host;
  } catch (error) {
    console.error("Invalid BACKEND_API_URL:", error);
    return "cliproxyapi:8317";
  }
})();

async function proxyRequest(
  method: string,
  path: string,
  request: NextRequest
): Promise<NextResponse> {
  const session = await verifySession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }

  if (!MANAGEMENT_API_KEY) {
    console.error("MANAGEMENT_API_KEY is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const incomingUrl = new URL(request.url);
  const queryString = incomingUrl.search;
  const targetUrl = `${BACKEND_API_URL}/${path}${queryString}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (error) {
    console.error("Invalid target URL:", targetUrl);
    return NextResponse.json(
      { error: "Invalid request path" },
      { status: 400 }
    );
  }

  if (parsedUrl.host !== ALLOWED_HOST) {
    console.error(`SSRF attempt blocked: ${parsedUrl.host} !== ${ALLOWED_HOST}`);
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  try {
    const headers: HeadersInit = {
      "Authorization": `Bearer ${MANAGEMENT_API_KEY}`,
    };

    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    let body: BodyInit | undefined = undefined;
    if (method !== "GET" && method !== "HEAD") {
      const rawBody = await request.text();
      if (rawBody) {
        body = rawBody;
      }
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    const responseContentType = response.headers.get("content-type");
    const responseData = await response.text();

    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        "Content-Type": responseContentType || "application/json",
      },
    });
  } catch (error) {
    console.error("Proxy request error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request" },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest("GET", path.join("/"), request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest("POST", path.join("/"), request);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest("PUT", path.join("/"), request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest("PATCH", path.join("/"), request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest("DELETE", path.join("/"), request);
}
