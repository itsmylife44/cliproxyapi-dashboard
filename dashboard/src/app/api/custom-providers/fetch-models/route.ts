import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { z } from "zod";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";

const FetchModelsSchema = z.object({
  baseUrl: z.string().startsWith("https://", "Base URL must start with https://"),
  apiKey: z.string().min(1)
});

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

    // Normalize baseUrl: strip trailing slash and /v1 suffix
    let normalizedBaseUrl = validated.baseUrl.replace(/\/+$/, "");
    if (normalizedBaseUrl.endsWith("/v1")) {
      normalizedBaseUrl = normalizedBaseUrl.slice(0, -3);
    }

    const modelsEndpoint = `${normalizedBaseUrl}/v1/models`;

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
        signal: controller.signal
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
