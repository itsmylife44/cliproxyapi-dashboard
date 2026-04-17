import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { z } from "zod";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";
import { FetchModelsSchema } from "@/lib/validation/schemas";
import { lookup } from "dns/promises";
import { apiError, Errors, ERROR_CODE } from "@/lib/errors";
import { env } from "@/lib/env";

interface OpenAIModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

interface OpenAIModelsResponse {
  data?: OpenAIModel[];
  models?: OpenAIModel[];
}

/**
 * Cloud instance-metadata endpoints. Always blocked regardless of
 * ALLOW_LOCAL_PROVIDER_URLS — unblocking these enables credential theft on
 * AWS/GCP/Azure/Alibaba/Oracle.
 */
function isCloudMetadataIPv4(a: number, b: number, c: number, d: number): boolean {
  // 169.254.169.254 (AWS, GCP, Azure, OpenStack, DigitalOcean, Oracle)
  if (a === 169 && b === 254 && c === 169 && d === 254) return true;
  // 100.100.100.200 (Alibaba Cloud)
  if (a === 100 && b === 100 && c === 100 && d === 200) return true;
  return false;
}

function isPrivateIPv4(a: number, b: number): boolean {
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;            // 192.168.0.0/16
  if (a === 169 && b === 254) return true;            // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 127) return true;                         // 127.0.0.0/8
  if (a === 0) return true;                           // 0.0.0.0/8
  return false;
}

/**
 * Docker Compose service hostnames that are safe to reach from inside the network.
 * These resolve to private IPs but are trusted internal services, not SSRF targets.
 */
const ALLOWED_INTERNAL_HOSTS = new Set([
  "perplexity-sidecar",
  "cliproxyapi",
]);

/**
 * Block SSRF. Returns true when the hostname MUST be rejected.
 * When `allowLocal` is set, localhost/RFC1918/link-local are permitted, but
 * cloud-metadata addresses remain blocked unconditionally.
 */
function isPrivateHost(hostname: string, allowLocal: boolean): boolean {
  const lower = hostname.toLowerCase();

  if (ALLOWED_INTERNAL_HOSTS.has(lower)) {
    return false;
  }

  // IPv4 literal
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    const c = Number(ipv4Match[3]);
    const d = Number(ipv4Match[4]);
    if (isCloudMetadataIPv4(a, b, c, d)) return true;
    if (allowLocal) return false;
    return isPrivateIPv4(a, b);
  }

  if (lower === "localhost" || lower === "127.0.0.1" || lower === "[::1]" || lower === "0.0.0.0") {
    return !allowLocal;
  }

  // IPv6 (strip brackets for URL-style [::1])
  const ipv6 = lower.replace(/^\[|\]$/g, "");
  if (ipv6 === "::1" || ipv6.startsWith("fe80:") || ipv6.startsWith("fc") || ipv6.startsWith("fd")) {
    return !allowLocal;
  }

  // IPv4-mapped IPv6: ::ffff:A.B.C.D (dotted) or ::ffff:AABB:CCDD (hex)
  const dottedMatch = ipv6.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dottedMatch) {
    const a = Number(dottedMatch[1]);
    const b = Number(dottedMatch[2]);
    const c = Number(dottedMatch[3]);
    const d = Number(dottedMatch[4]);
    if (isCloudMetadataIPv4(a, b, c, d)) return true;
    if (allowLocal) return false;
    return isPrivateIPv4(a, b);
  }
  const hexMatch = ipv6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMatch) {
    const hi = parseInt(hexMatch[1], 16);
    const lo = parseInt(hexMatch[2], 16);
    const a = (hi >> 8) & 0xff;
    const b = hi & 0xff;
    const c = (lo >> 8) & 0xff;
    const d = lo & 0xff;
    if (isCloudMetadataIPv4(a, b, c, d)) return true;
    if (allowLocal) return false;
    return isPrivateIPv4(a, b);
  }

  return false;
}

function isIPv6Literal(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  // URL.hostname returns bracket-less IPv6 for valid URLs, keep bracket stripping for safety.
  // We only need a reliable literal detector to skip DNS lookup; private/public decision is handled elsewhere.
  return value.includes(":");
}

function getFetchNetworkErrorMessage(fetchError: Error, hostname: string): string {
  const cause = "cause" in fetchError && fetchError.cause && typeof fetchError.cause === "object"
    ? fetchError.cause as Record<string, unknown>
    : null;

  const code = typeof cause?.code === "string" ? cause.code : null;
  const isIPv6Host = isIPv6Literal(hostname);

  if (code === "ENETUNREACH") {
    return isIPv6Host
      ? "IPv6 network unreachable from the dashboard container"
      : "Network unreachable from the dashboard container";
  }

  if (code === "EHOSTUNREACH") {
    return "Host unreachable from the dashboard container";
  }

  if (code === "ECONNREFUSED") {
    return "Connection refused by the provider endpoint";
  }

  if (code === "ETIMEDOUT") {
    return "Connection to the provider timed out";
  }

  return "Network error: unable to reach the provider";
}

/**
 * Check if a resolved IP address is private/internal.
 * Used after DNS resolution to prevent DNS rebinding attacks.
 */
function isPrivateResolvedIP(ip: string, allowLocal: boolean): boolean {
  // IPv4
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    const c = Number(ipv4Match[3]);
    const d = Number(ipv4Match[4]);
    if (isCloudMetadataIPv4(a, b, c, d)) return true;
    if (allowLocal) return false;
    return isPrivateIPv4(a, b);
  }

  // IPv6 loopback and private ranges
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return !allowLocal;
  }

  // IPv4-mapped IPv6
  const mappedMatch = normalized.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (mappedMatch) {
    const a = Number(mappedMatch[1]);
    const b = Number(mappedMatch[2]);
    const c = Number(mappedMatch[3]);
    const d = Number(mappedMatch[4]);
    if (isCloudMetadataIPv4(a, b, c, d)) return true;
    if (allowLocal) return false;
    return isPrivateIPv4(a, b);
  }

  return false;
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimitWithPreset(request, "custom-providers-fetch-models", "CUSTOM_PROVIDERS");
  if (!rateLimit.allowed) {
    return Errors.rateLimited(rateLimit.retryAfterSeconds);
  }

  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body = await request.json();
    const validated = FetchModelsSchema.parse(body);

    const normalizedBaseUrl = validated.baseUrl.replace(/\/+$/, "");

    // SSRF protection: block private/localhost hosts
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(`${normalizedBaseUrl}/models`);
    } catch {
      return Errors.validation("Invalid URL");
    }

    const allowLocal = env.ALLOW_LOCAL_PROVIDER_URLS;

    if (isPrivateHost(parsedUrl.hostname, allowLocal)) {
      logger.warn({ hostname: parsedUrl.hostname }, "Blocked SSRF attempt to private host");
      return Errors.validation("Cannot connect to private or localhost addresses");
    }

    // DNS rebinding protection: resolve hostname and verify the IP is not private.
    // This prevents attackers from using a domain that initially resolves to a public IP
    // but re-resolves to an internal IP (e.g., 127.0.0.1) at request time.
    // Skip check for allowed internal Docker hosts (they resolve to private IPs by design).
    const ipv4Match = parsedUrl.hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    const isIpLiteral = !!ipv4Match || isIPv6Literal(parsedUrl.hostname);
    if (!isIpLiteral && !ALLOWED_INTERNAL_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
      try {
        const resolved = await lookup(parsedUrl.hostname);
        if (isPrivateResolvedIP(resolved.address, allowLocal)) {
          logger.warn(
            { hostname: parsedUrl.hostname, resolvedIp: resolved.address },
            "Blocked SSRF: hostname resolved to private IP (possible DNS rebinding)"
          );
          return Errors.validation("Cannot connect to private or localhost addresses");
        }
      } catch (dnsError) {
        logger.warn({ hostname: parsedUrl.hostname, err: dnsError }, "DNS resolution failed for provider URL");
        return Errors.validation("Could not resolve hostname");
      }
    }

    const modelsEndpoint = parsedUrl.toString();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (validated.apiKey && validated.apiKey.length > 0) {
        requestHeaders["Authorization"] = `Bearer ${validated.apiKey}`;
      }

      const response = await fetch(modelsEndpoint, {
        method: "GET",
        headers: requestHeaders,
        signal: controller.signal,
        redirect: "error"
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) {
          return Errors.invalidCredentials();
        }
        if (response.status === 404) {
          return Errors.notFound("Models endpoint");
        }
        logger.error({ status: response.status, url: modelsEndpoint }, "Failed to fetch models from provider");
        return Errors.badGateway(`Failed to fetch models (HTTP ${response.status})`);
      }

      const responseData: OpenAIModelsResponse = await response.json();

      const modelList = responseData.data || responseData.models || [];

      if (!Array.isArray(modelList)) {
        logger.error({ responseData }, "Invalid models response format");
        return Errors.internal("Invalid response format from provider");
      }

      if (modelList.length === 0) {
        return Errors.notFound("Models");
      }

      const models = modelList.map(model => ({
        id: model.id,
        name: model.id
      }));

      return NextResponse.json({ models });

    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          logger.error({ url: modelsEndpoint }, "Fetch models request timed out");
          return Errors.gatewayTimeout("Request timed out. The provider may be unreachable.");
        }

        logger.error({ err: fetchError, url: modelsEndpoint }, "Failed to fetch models from provider");
        return apiError(
          ERROR_CODE.UPSTREAM_ERROR,
          getFetchNetworkErrorMessage(fetchError, parsedUrl.hostname),
          503
        );
      }

      return Errors.internal("Failed to fetch models from provider", fetchError);
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return Errors.zodValidation(error.issues);
    }
    return Errors.internal("POST /api/custom-providers/fetch-models error", error);
  }
}
