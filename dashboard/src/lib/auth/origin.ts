import { NextRequest, NextResponse } from "next/server";

function getForwardedHost(request: NextRequest): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    return forwardedHost.split(",")[0]?.trim() ?? null;
  }

  const host = request.headers.get("host");
  return host ? host.trim() : null;
}

function getForwardedProtocol(request: NextRequest, fallbackProtocol: string): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (!forwardedProto) return fallbackProtocol;

  return forwardedProto.split(",")[0]?.trim() || fallbackProtocol;
}

export function validateOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  
  if (!origin) {
    return null;
  }
  
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);

    const effectiveHost = getForwardedHost(request) ?? requestUrl.host;
    const effectiveProtocol = getForwardedProtocol(request, requestUrl.protocol.replace(":", ""));

    const allowedOrigins = new Set<string>([
      `${requestUrl.protocol}//${requestUrl.host}`,
      `${effectiveProtocol}://${effectiveHost}`,
    ]);

    if (!allowedOrigins.has(originUrl.origin)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }
  
  return null;
}
