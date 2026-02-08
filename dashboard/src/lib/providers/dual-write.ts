import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Prisma } from "@/generated/prisma/client";
import { hashProviderKey, maskProviderKey } from "./hash";
import { PROVIDER, PROVIDER_ENDPOINT, type Provider, type OAuthProvider } from "./constants";
import { getMaxProviderKeysPerUser } from "./settings";
import { invalidateUsageCaches, invalidateProxyModelsCache } from "@/lib/cache";

// Per-provider async mutex to serialize GET-modify-PUT sequences.
// Prevents race conditions where concurrent requests read the same state,
// modify independently, and the last write overwrites the first.
// In-process only — sufficient because dashboard runs as a single Node.js process.
class AsyncMutex {
  private locks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = () => {
        this.locks.delete(key);
        resolve();
      };
    });
    this.locks.set(key, promise);
    return release;
  }
}

const providerMutex = new AsyncMutex();

const MANAGEMENT_BASE_URL = env.CLIPROXYAPI_MANAGEMENT_URL;
const MANAGEMENT_API_KEY = env.MANAGEMENT_API_KEY;
const FETCH_TIMEOUT_MS = 10000; // 10 second timeout for all Management API calls

/**
 * Wrapper for fetch with timeout using AbortController.
 * Ensures requests don't hang indefinitely.
 */
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

interface ContributeKeyResult {
  ok: boolean;
  keyHash?: string;
  keyIdentifier?: string;
  error?: string;
}

interface RemoveKeyResult {
  ok: boolean;
  error?: string;
}

interface KeyWithOwnership {
  keyHash: string;
  maskedKey: string;
  provider: string;
  ownerUsername: string | null;
  ownerUserId: string | null;
  isOwn: boolean;
}

interface ListKeysResult {
  ok: boolean;
  keys?: KeyWithOwnership[];
  error?: string;
}

interface OAuthAccountWithOwnership {
  id: string;
  accountName: string;
  accountEmail: string | null;
  provider: string;
  ownerUsername: string | null;
  ownerUserId: string | null;
  isOwn: boolean;
}

interface ListOAuthResult {
  ok: boolean;
  accounts?: OAuthAccountWithOwnership[];
  error?: string;
}

interface ContributeOAuthResult {
  ok: boolean;
  id?: string;
  error?: string;
}

interface RemoveOAuthResult {
  ok: boolean;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isApiKeyArray(value: unknown): value is Array<{ "api-key": string }> {
  if (!Array.isArray(value)) return false;
  return value.every((item) => isRecord(item) && typeof item["api-key"] === "string");
}

function isOpenAICompatArray(
  value: unknown
): value is Array<{ name: string; "api-key-entries": Array<{ "api-key": string }> }> {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      isRecord(item) &&
      typeof item.name === "string" &&
      Array.isArray(item["api-key-entries"]) &&
      (item["api-key-entries"] as unknown[]).every(
        (entry) => isRecord(entry) && typeof entry["api-key"] === "string"
      )
  );
}

export async function contributeKey(
  userId: string,
  provider: Provider,
  apiKey: string
): Promise<ContributeKeyResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

  if (!apiKey || apiKey.trim().length === 0) {
    return { ok: false, error: "API key is required" };
  }

  const trimmedKey = apiKey.trim();
  const keyHash = hashProviderKey(trimmedKey);
  const keyIdentifier = maskProviderKey(trimmedKey);

  const userKeyCount = await prisma.providerKeyOwnership.count({
    where: { userId },
  });

  const maxKeys = await getMaxProviderKeysPerUser();

  if (userKeyCount >= maxKeys) {
    return { ok: false, error: `Key limit reached (${maxKeys} keys per user)` };
  }

  const lockKey = PROVIDER_ENDPOINT[provider];
  const release = await providerMutex.acquire(lockKey);

  try {
    try {
      await prisma.providerKeyOwnership.create({
        data: { userId, provider, keyIdentifier, keyHash },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return { ok: false, error: "API key already contributed" };
      }
      throw e;
    }

    const endpoint = `${MANAGEMENT_BASE_URL}${PROVIDER_ENDPOINT[provider]}`;

    let getRes: Response;
    try {
      getRes = await fetchWithTimeout(endpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
      });
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("Fetch timeout - contributeKey GET", {
          endpoint,
          provider,
          timeoutMs: FETCH_TIMEOUT_MS,
        });
        await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
        return { ok: false, error: "Request timeout fetching existing keys" };
      }
      throw fetchError;
    }

    if (!getRes.ok) {
      await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
      return { ok: false, error: `Failed to fetch existing keys: HTTP ${getRes.status}` };
    }

    const getData = await getRes.json();

    let updatedPayload: unknown;

    if (provider === PROVIDER.OPENAI_COMPAT) {
      const responseKey = "openai-compatibility";
      const rawData = getData[responseKey];
      if (!isRecord(getData)) {
        await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
        return { ok: false, error: "Invalid Management API response for OpenAI compatibility" };
      }
      if (rawData === null || (Array.isArray(rawData) && rawData.length === 0)) {
        updatedPayload = [];
      } else if (!isOpenAICompatArray(rawData)) {
        await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
        return { ok: false, error: "Invalid Management API response for OpenAI compatibility" };
      } else {
        updatedPayload = rawData;
      }
    } else {
      const responseKey = `${provider}-api-key`;
      const rawData = getData[responseKey];
      if (!isRecord(getData)) {
        await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
        return { ok: false, error: `Invalid Management API response for ${provider}` };
      }

      if (rawData === null || (Array.isArray(rawData) && rawData.length === 0)) {
        updatedPayload = [{ "api-key": trimmedKey }];
      } else if (!isApiKeyArray(rawData)) {
        await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
        return { ok: false, error: `Invalid Management API response for ${provider}` };
      } else {
        updatedPayload = [...rawData, { "api-key": trimmedKey }];
      }
    }

    let putRes: Response;
    try {
      putRes = await fetchWithTimeout(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        },
        body: JSON.stringify(updatedPayload),
      });
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("Fetch timeout - contributeKey PUT", {
          endpoint,
          provider,
          timeoutMs: FETCH_TIMEOUT_MS,
        });
        await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
        return { ok: false, error: "Request timeout adding key to Management API" };
      }
      throw fetchError;
    }

    if (!putRes.ok) {
      await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
      return { ok: false, error: `Failed to add key to Management API: HTTP ${putRes.status}` };
    }

    invalidateUsageCaches();
    invalidateProxyModelsCache();

    return {
      ok: true,
      keyHash,
      keyIdentifier,
    };
  } catch (error) {
    console.error("contributeKey error:", error);

    try {
      await prisma.providerKeyOwnership.deleteMany({
        where: { keyHash },
      });
    } catch (rollbackError) {
      console.error("Failed to rollback ownership record:", rollbackError);
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during key contribution",
    };
  } finally {
    release();
  }
}

export async function removeKey(
  userId: string,
  keyHash: string,
  isAdmin: boolean
): Promise<RemoveKeyResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

  const ownership = await prisma.providerKeyOwnership.findUnique({
    where: { keyHash },
    include: { user: { select: { username: true } } },
  });

  if (!ownership) {
    return { ok: false, error: "Key not found" };
  }

  if (!isAdmin && ownership.userId !== userId) {
    return { ok: false, error: "Access denied" };
  }

  const lockKey = PROVIDER_ENDPOINT[ownership.provider as Provider];
  const release = await providerMutex.acquire(lockKey);

   try {
     const endpoint = `${MANAGEMENT_BASE_URL}${PROVIDER_ENDPOINT[ownership.provider as Provider]}`;

     let getRes: Response;
     try {
       getRes = await fetchWithTimeout(endpoint, {
         method: "GET",
         headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
       });
     } catch (fetchError) {
       if (fetchError instanceof Error && fetchError.name === "AbortError") {
         console.error("Fetch timeout - removeKey GET", {
           endpoint,
           provider: ownership.provider,
           keyHash,
           timeoutMs: FETCH_TIMEOUT_MS,
         });
         return { ok: false, error: "Request timeout fetching existing keys" };
       }
       throw fetchError;
     }

     if (!getRes.ok) {
       return { ok: false, error: `Failed to fetch existing keys: HTTP ${getRes.status}` };
     }

    const getData = await getRes.json();
    const responseKey =
      ownership.provider === PROVIDER.OPENAI_COMPAT
        ? "openai-compatibility"
        : `${ownership.provider}-api-key`;

    if (!isRecord(getData)) {
      return { ok: false, error: "Invalid Management API response" };
    }

    const rawKeys = getData[responseKey];

    let matchingKey: string | null = null;

    if (ownership.provider === PROVIDER.OPENAI_COMPAT) {
      if (!isOpenAICompatArray(rawKeys)) {
        return { ok: false, error: "Invalid OpenAI compatibility response" };
      }

      for (const providerEntry of rawKeys) {
        for (const keyEntry of providerEntry["api-key-entries"]) {
          const candidateHash = hashProviderKey(keyEntry["api-key"]);
          if (candidateHash === keyHash) {
            matchingKey = keyEntry["api-key"];
            break;
          }
        }
        if (matchingKey) break;
      }
    } else {
      if (!isApiKeyArray(rawKeys)) {
        return { ok: false, error: `Invalid ${ownership.provider} response` };
      }

      for (const keyEntry of rawKeys) {
        const candidateHash = hashProviderKey(keyEntry["api-key"]);
        if (candidateHash === keyHash) {
          matchingKey = keyEntry["api-key"];
          break;
        }
      }
    }

     if (!matchingKey) {
       await prisma.providerKeyOwnership.delete({ where: { keyHash } });
       return { ok: false, error: "Key not found in Management API (orphan record removed)" };
     }

     let deleteRes: Response;
     try {
       deleteRes = await fetchWithTimeout(
         `${endpoint}?api-key=${encodeURIComponent(matchingKey)}`,
         {
           method: "DELETE",
           headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
         }
       );
     } catch (fetchError) {
       if (fetchError instanceof Error && fetchError.name === "AbortError") {
         console.error("Fetch timeout - removeKey DELETE", {
           endpoint,
           provider: ownership.provider,
           keyHash,
           timeoutMs: FETCH_TIMEOUT_MS,
         });
         return { ok: false, error: "Request timeout deleting key from Management API" };
       }
       throw fetchError;
     }

     if (!deleteRes.ok) {
       return { ok: false, error: `Failed to delete key from Management API: HTTP ${deleteRes.status}` };
     }

    await prisma.providerKeyOwnership.delete({ where: { keyHash } });

    invalidateUsageCaches();
    invalidateProxyModelsCache();

    return { ok: true };
  } catch (error) {
    console.error("removeKey error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during key removal",
    };
  } finally {
    release();
  }
}

export async function removeKeyByAdmin(
  keyHash: string,
  provider: Provider
): Promise<RemoveKeyResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

  const lockKey = PROVIDER_ENDPOINT[provider];
  const release = await providerMutex.acquire(lockKey);

   try {
     const endpoint = `${MANAGEMENT_BASE_URL}${PROVIDER_ENDPOINT[provider]}`;

     let getRes: Response;
     try {
       getRes = await fetchWithTimeout(endpoint, {
         method: "GET",
         headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
       });
     } catch (fetchError) {
       if (fetchError instanceof Error && fetchError.name === "AbortError") {
         console.error("Fetch timeout - removeKeyByAdmin GET", {
           endpoint,
           provider,
           keyHash,
           timeoutMs: FETCH_TIMEOUT_MS,
         });
         return { ok: false, error: "Request timeout fetching existing keys" };
       }
       throw fetchError;
     }

     if (!getRes.ok) {
       return { ok: false, error: `Failed to fetch existing keys: HTTP ${getRes.status}` };
     }

     const getData = await getRes.json();
     const responseKey =
       provider === PROVIDER.OPENAI_COMPAT
         ? "openai-compatibility"
         : `${provider}-api-key`;

    if (!isRecord(getData)) {
      return { ok: false, error: "Invalid Management API response" };
    }

    const rawKeys = getData[responseKey];
    let matchingKey: string | null = null;

    if (provider === PROVIDER.OPENAI_COMPAT) {
      if (!isOpenAICompatArray(rawKeys)) {
        return { ok: false, error: "Invalid OpenAI compatibility response" };
      }

      for (const providerEntry of rawKeys) {
        for (const keyEntry of providerEntry["api-key-entries"]) {
          const candidateHash = hashProviderKey(keyEntry["api-key"]);
          if (candidateHash === keyHash) {
            matchingKey = keyEntry["api-key"];
            break;
          }
        }
        if (matchingKey) break;
      }
    } else {
      if (!isApiKeyArray(rawKeys)) {
        return { ok: false, error: `Invalid ${provider} response` };
      }

      for (const keyEntry of rawKeys) {
        const candidateHash = hashProviderKey(keyEntry["api-key"]);
        if (candidateHash === keyHash) {
          matchingKey = keyEntry["api-key"];
          break;
        }
      }
    }

     if (!matchingKey) {
       return { ok: false, error: "Key not found in Management API" };
     }

     let deleteRes: Response;
     try {
       deleteRes = await fetchWithTimeout(
         `${endpoint}?api-key=${encodeURIComponent(matchingKey)}`,
         {
           method: "DELETE",
           headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
         }
       );
     } catch (fetchError) {
       if (fetchError instanceof Error && fetchError.name === "AbortError") {
         console.error("Fetch timeout - removeKeyByAdmin DELETE", {
           endpoint,
           provider,
           keyHash,
           timeoutMs: FETCH_TIMEOUT_MS,
         });
         return { ok: false, error: "Request timeout deleting key from Management API" };
       }
       throw fetchError;
     }

     if (!deleteRes.ok) {
       return { ok: false, error: `Failed to delete key from Management API: HTTP ${deleteRes.status}` };
     }

     invalidateUsageCaches();
     invalidateProxyModelsCache();

     return { ok: true };
   } catch (error) {
     console.error("removeKeyByAdmin error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during key removal",
    };
  } finally {
    release();
  }
}

export async function listKeysWithOwnership(
  userId: string,
  provider: Provider
): Promise<ListKeysResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

   try {
     const endpoint = `${MANAGEMENT_BASE_URL}${PROVIDER_ENDPOINT[provider]}`;

     let getRes: Response;
     try {
       getRes = await fetchWithTimeout(endpoint, {
         method: "GET",
         headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
       });
     } catch (fetchError) {
       if (fetchError instanceof Error && fetchError.name === "AbortError") {
         console.error("Fetch timeout - listKeysWithOwnership GET", {
           endpoint,
           provider,
           timeoutMs: FETCH_TIMEOUT_MS,
         });
         return { ok: false, error: "Request timeout fetching keys" };
       }
       throw fetchError;
     }

     if (!getRes.ok) {
       return { ok: false, error: `Failed to fetch keys: HTTP ${getRes.status}` };
     }

     const getData = await getRes.json();
     const responseKey =
       provider === PROVIDER.OPENAI_COMPAT ? "openai-compatibility" : `${provider}-api-key`;

    if (!isRecord(getData)) {
      return { ok: false, error: "Invalid Management API response" };
    }

    const rawKeys = getData[responseKey];
    const apiKeys: string[] = [];

    if (provider === PROVIDER.OPENAI_COMPAT) {
      if (rawKeys === null || (Array.isArray(rawKeys) && rawKeys.length === 0)) {
        // No keys configured yet
      } else if (!isOpenAICompatArray(rawKeys)) {
        return { ok: false, error: "Invalid OpenAI compatibility response" };
      } else {
        for (const providerEntry of rawKeys) {
          for (const keyEntry of providerEntry["api-key-entries"]) {
            apiKeys.push(keyEntry["api-key"]);
          }
        }
      }
    } else {
      if (rawKeys === null || (Array.isArray(rawKeys) && rawKeys.length === 0)) {
        // No keys configured yet
      } else if (!isApiKeyArray(rawKeys)) {
        return { ok: false, error: `Invalid ${provider} response` };
      } else {
        for (const keyEntry of rawKeys) {
          apiKeys.push(keyEntry["api-key"]);
        }
      }
    }

    const keyHashes = apiKeys.map((key) => hashProviderKey(key));

     const ownerships = await prisma.providerKeyOwnership.findMany({
        where: { keyHash: { in: keyHashes }, provider },
        select: { 
          keyHash: true,
          userId: true,
          user: { select: { id: true, username: true } }
        },
      });

    const ownershipMap = new Map(ownerships.map((o) => [o.keyHash, o]));

      const keysWithOwnership: KeyWithOwnership[] = apiKeys.map((key, index) => {
        const hash = hashProviderKey(key);
        const ownership = ownershipMap.get(hash);
        const isOwn = ownership?.userId === userId;

        return {
          keyHash: hash,
          maskedKey: isOwn ? maskProviderKey(key) : `Key ${index + 1}`,
          provider,
          ownerUsername: isOwn ? ownership?.user.username || null : null,
          ownerUserId: isOwn ? ownership?.user.id || null : null,
          isOwn,
        };
      });

    return { ok: true, keys: keysWithOwnership };
  } catch (error) {
    console.error("listKeysWithOwnership error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during key listing",
    };
  }
}

export async function contributeOAuthAccount(
  userId: string,
  provider: OAuthProvider,
  accountName: string,
  accountEmail?: string
): Promise<ContributeOAuthResult> {
  try {
    const existingOwnership = await prisma.providerOAuthOwnership.findUnique({
      where: { accountName },
    });

    if (existingOwnership) {
      return { ok: false, error: "OAuth account already registered" };
    }

    const ownership = await prisma.providerOAuthOwnership.create({
      data: {
        userId,
        provider,
        accountName,
        accountEmail: accountEmail || null,
      },
    });

    return { ok: true, id: ownership.id };
  } catch (error) {
    console.error("contributeOAuthAccount error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during OAuth registration",
    };
  }
}

export async function listOAuthWithOwnership(
  userId: string,
  isAdmin: boolean = false
): Promise<ListOAuthResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

   try {
     const endpoint = `${MANAGEMENT_BASE_URL}/auth-files`;

     let getRes: Response;
     try {
       getRes = await fetchWithTimeout(endpoint, {
         method: "GET",
         headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
       });
     } catch (fetchError) {
       if (fetchError instanceof Error && fetchError.name === "AbortError") {
         console.error("Fetch timeout - listOAuthWithOwnership GET", {
           endpoint,
           timeoutMs: FETCH_TIMEOUT_MS,
         });
         return { ok: false, error: "Request timeout fetching OAuth accounts" };
       }
       throw fetchError;
     }

     if (!getRes.ok) {
       return { ok: false, error: `Failed to fetch OAuth accounts: HTTP ${getRes.status}` };
     }

     const getData = await getRes.json();

    if (!isRecord(getData) || !Array.isArray(getData.files)) {
      return { ok: false, error: "Invalid Management API response for OAuth accounts" };
    }

    const authFiles = getData.files as Array<{
      id: string;
      name: string;
      provider?: string;
      type?: string;
      email?: string;
    }>;

    const accountNames = authFiles.map((file) => file.name);

    const ownerships = await prisma.providerOAuthOwnership.findMany({
      where: { accountName: { in: accountNames } },
      include: { user: { select: { id: true, username: true } } },
    });

    const ownershipMap = new Map(ownerships.map((o) => [o.accountName, o]));

     const accountsWithOwnership: OAuthAccountWithOwnership[] = authFiles.map((file, index) => {
       const ownership = ownershipMap.get(file.name);
       const isOwn = ownership?.userId === userId;
       const canSeeDetails = isOwn || isAdmin;

       return {
         id: canSeeDetails ? file.id : `account-${index + 1}`,
         accountName: canSeeDetails ? file.name : `Account ${index + 1}`,
         accountEmail: canSeeDetails ? file.email || null : null,
         provider: file.provider || file.type || "unknown",
         ownerUsername: canSeeDetails ? ownership?.user.username || null : null,
         ownerUserId: canSeeDetails ? ownership?.user.id || null : null,
         isOwn,
       };
     });

    return { ok: true, accounts: accountsWithOwnership };
  } catch (error) {
    console.error("listOAuthWithOwnership error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during OAuth listing",
    };
  }
}

interface ResolveOAuthResult {
  accountName: string | null;
  ownership: { id: string; userId: string } | null;
}

async function resolveOAuthAccountByIdOrName(
  idOrName: string
): Promise<ResolveOAuthResult> {
  // First try to find by DB ID (CUID)
  const byId = await prisma.providerOAuthOwnership.findUnique({
    where: { id: idOrName },
    select: { id: true, userId: true, accountName: true },
  });

  if (byId) {
    return {
      accountName: byId.accountName,
      ownership: { id: byId.id, userId: byId.userId },
    };
  }

  // Fallback: treat as management file name/id directly
  return {
    accountName: idOrName,
    ownership: null,
  };
}

export async function removeOAuthAccount(
  userId: string,
  accountName: string,
  isAdmin: boolean
): Promise<RemoveOAuthResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

  try {
    const ownership = await prisma.providerOAuthOwnership.findUnique({
      where: { accountName },
    });

    if (ownership && !isAdmin && ownership.userId !== userId) {
      return { ok: false, error: "Access denied" };
    }

     const endpoint = `${MANAGEMENT_BASE_URL}/auth-files?name=${encodeURIComponent(accountName)}`;

     let deleteRes: Response;
     try {
       deleteRes = await fetchWithTimeout(endpoint, {
         method: "DELETE",
         headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
       });
     } catch (fetchError) {
       if (fetchError instanceof Error && fetchError.name === "AbortError") {
         console.error("Fetch timeout - removeOAuthAccount DELETE", {
           endpoint,
           accountName,
           timeoutMs: FETCH_TIMEOUT_MS,
         });
         return { ok: false, error: "Request timeout removing OAuth account" };
       }
       throw fetchError;
     }

     if (!deleteRes.ok) {
       return { ok: false, error: `Failed to remove OAuth account: HTTP ${deleteRes.status}` };
     }

    if (ownership) {
      await prisma.providerOAuthOwnership.delete({ where: { accountName } });
    }

    return { ok: true };
  } catch (error) {
    console.error("removeOAuthAccount error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during OAuth removal",
    };
  }
}

export async function removeOAuthAccountByIdOrName(
  userId: string,
  idOrName: string,
  isAdmin: boolean
): Promise<RemoveOAuthResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

  try {
    const resolved = await resolveOAuthAccountByIdOrName(idOrName);

    if (!resolved.accountName) {
      return { ok: false, error: "OAuth account not found" };
    }

    // Check ownership - if we have DB ownership, validate auth
    if (resolved.ownership) {
      if (!isAdmin && resolved.ownership.userId !== userId) {
        return { ok: false, error: "Access denied" };
      }
    } else {
      // No DB ownership - only admin can delete
      if (!isAdmin) {
        return { ok: false, error: "Access denied" };
      }
    }

     const endpoint = `${MANAGEMENT_BASE_URL}/auth-files?name=${encodeURIComponent(resolved.accountName)}`;

     let deleteRes: Response;
     try {
       deleteRes = await fetchWithTimeout(endpoint, {
         method: "DELETE",
         headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
       });
     } catch (fetchError) {
       if (fetchError instanceof Error && fetchError.name === "AbortError") {
         console.error("Fetch timeout - removeOAuthAccountByIdOrName DELETE", {
           endpoint,
           accountName: resolved.accountName,
           timeoutMs: FETCH_TIMEOUT_MS,
         });
         return { ok: false, error: "Request timeout removing OAuth account" };
       }
       throw fetchError;
     }

     if (!deleteRes.ok) {
       return { ok: false, error: `Failed to remove OAuth account: HTTP ${deleteRes.status}` };
     }

    // Clean up DB record if it exists
    if (resolved.ownership) {
      try {
        await prisma.providerOAuthOwnership.delete({
          where: { id: resolved.ownership.id },
        });
      } catch (e) {
        console.error("Failed to delete ownership record:", e);
        // Don't fail the deletion if DB cleanup fails
      }
    }

    return { ok: true };
  } catch (error) {
    console.error("removeOAuthAccountByIdOrName error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during OAuth removal",
    };
  }
}
