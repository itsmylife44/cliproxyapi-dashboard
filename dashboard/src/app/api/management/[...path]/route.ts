import { NextRequest, NextResponse } from "next/server";
import { posix as pathPosix } from "path";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const FETCH_TIMEOUT_MS = 30_000;

function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}

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

const NON_ADMIN_OAUTH_PATHS = new Set<string>([
  "anthropic-auth-url",
  "gemini-cli-auth-url",
  "codex-auth-url",
  "antigravity-auth-url",
  "get-auth-status",
]);

const ALLOWED_MANAGEMENT_PATHS = new Set<string>([
  "config",
  "usage",
  "logs",
  "logging-to-file",
  "latest-version",
  "auth-files",
  "openai-compatibility",
  "oauth-callback",
  ...NON_ADMIN_OAUTH_PATHS,
]);

const ALLOWED_MANAGEMENT_PATH_PATTERNS = [
  /^[a-z0-9-]+-api-key$/,
];

function isAllowedManagementPath(path: string): boolean {
  return (
    ALLOWED_MANAGEMENT_PATHS.has(path) ||
    ALLOWED_MANAGEMENT_PATH_PATTERNS.some((pattern) => pattern.test(path))
  );
}

function normalizeAndValidateManagementPath(rawPath: string): string | null {
  const loweredRawPath = rawPath.toLowerCase();
  if (
    rawPath.includes("\\") ||
    rawPath.includes("\0") ||
    rawPath.includes("..") ||
    loweredRawPath.includes("%2e%2e") ||
    loweredRawPath.includes("%00")
  ) {
    return null;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return null;
  }

  const loweredDecodedPath = decodedPath.toLowerCase();
  if (
    decodedPath.includes("\\") ||
    decodedPath.includes("\0") ||
    decodedPath.includes("..") ||
    loweredDecodedPath.includes("%2e%2e") ||
    loweredDecodedPath.includes("%00")
  ) {
    return null;
  }

  const normalizedPath = pathPosix
    .normalize(`/${decodedPath}`)
    .replace(/\/+/g, "/")
    .replace(/^\/+/, "");

  if (!normalizedPath || normalizedPath === ".") {
    return null;
  }

  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(normalizedPath)) {
    return null;
  }

  if (!isAllowedManagementPath(normalizedPath)) {
    return null;
  }

  return normalizedPath;
}

function isNonAdminAllowedManagementRequest(method: string, path: string): boolean {
  return method === "GET" && NON_ADMIN_OAUTH_PATHS.has(path);
}

async function proxyRequest(
  method: string,
  rawPath: string,
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

  const normalizedPath = normalizeAndValidateManagementPath(rawPath);
  if (!normalizedPath) {
    console.warn("Blocked invalid management proxy path", {
      method,
      rawPath,
      userId: session.userId,
      source: "api/management/[...path]",
    });
    return NextResponse.json(
      { error: "Invalid request path" },
      { status: 400 }
    );
  }

  if (!user?.isAdmin && !isNonAdminAllowedManagementRequest(method, normalizedPath)) {
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
  const targetUrl = new URL(BACKEND_API_URL);
  const basePath = targetUrl.pathname.replace(/\/+$/, "");
  targetUrl.pathname = `${basePath}/${normalizedPath}`;
  targetUrl.search = incomingUrl.search;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl.toString());
  } catch {
    console.error("Invalid target URL:", targetUrl.toString());
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

    let response: Response;
    try {
      response = await fetchWithTimeout(targetUrl.toString(), {
        method,
        headers,
        body,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json(
          { error: "Request timeout" },
          { status: 504 }
        );
      }
      throw error;
    }

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
