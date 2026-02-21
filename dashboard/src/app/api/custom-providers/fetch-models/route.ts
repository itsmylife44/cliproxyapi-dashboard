import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { z } from "zod";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";
import { FetchModelsSchema } from "@/lib/validation/schemas";

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
 * Block SSRF: reject URLs that resolve to localhost, private, or link-local addresses.
 */
function isPrivateIPv4(a: number, b: number): boolean {
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16
  if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 127) return true;                          // 127.0.0.0/8
  if (a === 0) return true;                            // 0.0.0.0/8
  return false;
}

/**
 * Docker Compose service hostnames that are safe to reach from inside the network.
 * These resolve to private IPs but are trusted internal services, not SSRF targets.
 */
const ALLOWED_INTERNAL_HOSTS = new Set([
  "perplexity-sidecar",
  "cliproxyapi",
  "dashboard",
  "postgres",
  "docker-proxy",
]);

/**
 * Block SSRF: reject localhost, private, link-local, and IPv4-mapped IPv6 addresses.
 */
function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (ALLOWED_INTERNAL_HOSTS.has(lower)) {
    return false;
  }

  if (lower === "localhost" || lower === "127.0.0.1" || lower === "[::1]" || lower === "0.0.0.0") {
    return true;
  }

  // IPv4 literal
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    return isPrivateIPv4(Number(ipv4Match[1]), Number(ipv4Match[2]));
  }

  // IPv6 (strip brackets for URL-style [::1])
  const ipv6 = lower.replace(/^\[|\]$/g, "");
  if (ipv6 === "::1" || ipv6.startsWith("fe80:") || ipv6.startsWith("fc") || ipv6.startsWith("fd")) {
    return true;
  }

  // IPv4-mapped IPv6: ::ffff:A.B.C.D (dotted) or ::ffff:AABB:CCDD (hex)
  const dottedMatch = ipv6.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dottedMatch) {
    return isPrivateIPv4(Number(dottedMatch[1]), Number(dottedMatch[2]));
  }
  const hexMatch = ipv6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMatch) {
    const hi = parseInt(hexMatch[1], 16);
    return isPrivateIPv4((hi >> 8) & 0xff, hi & 0xff);
  }

  return false;
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimitWithPreset(request, "custom-providers-fetch-models", "CUSTOM_PROVIDERS");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many fetch requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (isPrivateHost(parsedUrl.hostname)) {
      logger.warn({ hostname: parsedUrl.hostname }, "Blocked SSRF attempt to private host");
      return NextResponse.json(
        { error: "Cannot connect to private or localhost addresses" },
        { status: 400 }
      );
    }

    const modelsEndpoint = parsedUrl.toString();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(modelsEndpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${validated.apiKey}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        redirect: "error"
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return NextResponse.json(
            { error: "Authentication failed. Check your API key." },
            { status: 401 }
          );
        }
        if (response.status === 404) {
          return NextResponse.json(
            { error: "Models endpoint not found. This may not be an OpenAI-compatible API." },
            { status: 404 }
          );
        }
        logger.error({ status: response.status, url: modelsEndpoint }, "Failed to fetch models from provider");
        return NextResponse.json(
          { error: `Failed to fetch models (HTTP ${response.status})` },
          { status: response.status }
        );
      }

      const responseData: OpenAIModelsResponse = await response.json();

      // Handle both OpenAI format (data) and alternative format (models)
      const modelList = responseData.data || responseData.models || [];

      if (!Array.isArray(modelList)) {
        logger.error({ responseData }, "Invalid models response format");
        return NextResponse.json(
          { error: "Invalid response format from provider" },
          { status: 500 }
        );
      }

      if (modelList.length === 0) {
        return NextResponse.json(
          { error: "No models found from this provider" },
          { status: 404 }
        );
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
          return NextResponse.json(
            { error: "Request timed out. The provider may be unreachable." },
            { status: 504 }
          );
        }
        
        logger.error({ err: fetchError, url: modelsEndpoint }, "Failed to fetch models from provider");
        return NextResponse.json(
          { error: `Network error: ${fetchError.message}` },
          { status: 503 }
        );
      }

      logger.error({ err: fetchError }, "Unknown error fetching models");
      return NextResponse.json(
        { error: "Failed to fetch models from provider" },
        { status: 500 }
      );
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, "POST /api/custom-providers/fetch-models error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
