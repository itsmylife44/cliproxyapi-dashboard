import { NextRequest, NextResponse } from "next/server";

function normalizePort(protocol: string, port: string): string {
  if (!port) return "";
  if (protocol === "https:" && port === "443") return "";
  if (protocol === "http:" && port === "80") return "";
  return port;
}

function isSameOrigin(origin: URL, candidate: URL): boolean {
  return (
    origin.protocol === candidate.protocol &&
    origin.hostname === candidate.hostname &&
    normalizePort(origin.protocol, origin.port) ===
      normalizePort(candidate.protocol, candidate.port)
  );
}

function toUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

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

    const allowedCandidates = [
      requestUrl.origin,
      `${effectiveProtocol}://${effectiveHost}`,
      process.env.DASHBOARD_URL,
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .map(toUrl)
      .filter((value): value is URL => value !== null);

    const isAllowed = allowedCandidates.some((candidate) =>
      isSameOrigin(originUrl, candidate)
    );

    if (!isAllowed) {
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
