/**
 * Fetch utilities with retry logic for transient failures.
 */

const RETRY_DELAYS = [500, 1000]; // Exponential backoff: 500ms, 1000ms
const IDEMPOTENT_METHODS = new Set(["GET", "PUT"]);

interface FetchWithRetryOptions extends RequestInit {
  timeout?: number;
}

/**
 * Wrapper for fetch with exponential backoff retry logic.
 * Only retries on network errors and 5xx responses.
 * Only for idempotent methods (GET, PUT) — NOT POST.
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options (method, headers, body, etc.) + optional timeout
 * @returns Promise<Response>
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { timeout, ...fetchOptions } = options;
  const method = fetchOptions.method?.toUpperCase() || "GET";

  // Skip retry for non-idempotent methods
  if (!IDEMPOTENT_METHODS.has(method)) {
    return fetchWithTimeout(url, timeout || 10000, fetchOptions);
  }

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  // Initial attempt + retries
  const attempts = 1 + RETRY_DELAYS.length;

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetchWithTimeout(url, timeout || 10000, fetchOptions);

      // Success or client error (4xx) → return immediately
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // 5xx error → retry
      lastResponse = response;

      // If this was the last attempt, return the error response
      if (i === attempts - 1) {
        return response;
      }

      // Wait before retry
      await sleep(RETRY_DELAYS[i]);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Network error → retry (unless last attempt)
      if (i === attempts - 1) {
        throw lastError;
      }

      // Wait before retry
      await sleep(RETRY_DELAYS[i]);
    }
  }

  // Should never reach here, but TypeScript needs a return
  if (lastResponse) return lastResponse;
  throw lastError || new Error("Unknown fetch error");
}

/**
 * Wrapper for fetch with timeout using AbortController.
 * Ensures requests don't hang indefinitely.
 */
function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Combine caller's signal (if any) with our timeout signal
  const { signal: callerSignal, ...rest } = options;
  const combinedSignal = callerSignal
    ? AbortSignal.any([controller.signal, callerSignal])
    : controller.signal;

  return fetch(url, { ...rest, signal: combinedSignal }).finally(() => {
    clearTimeout(timeout);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
