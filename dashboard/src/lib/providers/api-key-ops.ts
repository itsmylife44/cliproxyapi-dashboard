import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { Prisma } from "@/generated/prisma/client";
import { hashProviderKey, maskProviderKey } from "./hash";
import { PROVIDER, PROVIDER_ENDPOINT, type Provider } from "./constants";
import { getMaxProviderKeysPerUser } from "./settings";
import { invalidateUsageCaches, invalidateProxyModelsCache } from "@/lib/cache";
import {
  providerMutex,
  fetchWithTimeout,
  MANAGEMENT_BASE_URL,
  MANAGEMENT_API_KEY,
  FETCH_TIMEOUT_MS,
  isRecord,
  isApiKeyArray,
  isOpenAICompatArray,
  type ContributeKeyResult,
  type RemoveKeyResult,
  type ListKeysResult,
  type KeyWithOwnership,
} from "./management-api";

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
        logger.error({
          err: fetchError,
          endpoint,
          provider,
          timeoutMs: FETCH_TIMEOUT_MS,
        }, "Fetch timeout - contributeKey GET");
        await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
        return { ok: false, error: "Request timeout fetching existing keys" };
      }
      throw fetchError;
    }

    if (!getRes.ok) {
      await getRes.body?.cancel();
      await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
      return { ok: false, error: `Failed to fetch existing keys: HTTP ${getRes.status}` };
    }

    const getData = await getRes.json();

    let updatedPayload: unknown;

    if (!isRecord(getData)) {
      await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
      return { ok: false, error: `Invalid Management API response for ${provider}` };
    }

    if (provider === PROVIDER.OPENAI_COMPAT) {
      const responseKey = "openai-compatibility";
      const rawData = getData[responseKey];
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
        logger.error({
          err: fetchError,
          endpoint,
          provider,
          timeoutMs: FETCH_TIMEOUT_MS,
        }, "Fetch timeout - contributeKey PUT");
        await prisma.providerKeyOwnership.deleteMany({ where: { keyHash } });
        return { ok: false, error: "Request timeout adding key to Management API" };
      }
      throw fetchError;
    }

    if (!putRes.ok) {
      await putRes.body?.cancel();
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
    logger.error({ err: error, provider }, "contributeKey error");

    try {
      await prisma.providerKeyOwnership.deleteMany({
        where: { keyHash },
      });
    } catch (rollbackError) {
      logger.error({ err: rollbackError, keyHash }, "Failed to rollback ownership record");
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
          logger.error({
            err: fetchError,
            endpoint,
            provider: ownership.provider,
            keyHash,
            timeoutMs: FETCH_TIMEOUT_MS,
          }, "Fetch timeout - removeKey GET");
         return { ok: false, error: "Request timeout fetching existing keys" };
       }
       throw fetchError;
     }

      if (!getRes.ok) {
        await getRes.body?.cancel();
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
          logger.error({
            err: fetchError,
            endpoint,
            provider: ownership.provider,
            keyHash,
            timeoutMs: FETCH_TIMEOUT_MS,
          }, "Fetch timeout - removeKey DELETE");
         return { ok: false, error: "Request timeout deleting key from Management API" };
       }
       throw fetchError;
     }

     if (!deleteRes.ok) {
       await deleteRes.body?.cancel();
       return { ok: false, error: `Failed to delete key from Management API: HTTP ${deleteRes.status}` };
     }

    await prisma.providerKeyOwnership.delete({ where: { keyHash } });

    invalidateUsageCaches();
    invalidateProxyModelsCache();

    return { ok: true };
  } catch (error) {
    logger.error({ err: error, keyHash }, "removeKey error");
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
          logger.error({
            err: fetchError,
            endpoint,
            provider,
            keyHash,
            timeoutMs: FETCH_TIMEOUT_MS,
          }, "Fetch timeout - removeKeyByAdmin GET");
         return { ok: false, error: "Request timeout fetching existing keys" };
       }
       throw fetchError;
     }

      if (!getRes.ok) {
        await getRes.body?.cancel();
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
          logger.error({
            err: fetchError,
            endpoint,
            provider,
            keyHash,
            timeoutMs: FETCH_TIMEOUT_MS,
          }, "Fetch timeout - removeKeyByAdmin DELETE");
         return { ok: false, error: "Request timeout deleting key from Management API" };
       }
       throw fetchError;
     }

      if (!deleteRes.ok) {
        await deleteRes.body?.cancel();
        return { ok: false, error: `Failed to delete key from Management API: HTTP ${deleteRes.status}` };
      }

     invalidateUsageCaches();
     invalidateProxyModelsCache();

     return { ok: true };
} catch (error) {
      logger.error({ err: error, keyHash, provider }, "removeKeyByAdmin error");
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
          logger.error({
            err: fetchError,
            endpoint,
            provider,
            timeoutMs: FETCH_TIMEOUT_MS,
          }, "Fetch timeout - listKeysWithOwnership GET");
         return { ok: false, error: "Request timeout fetching keys" };
       }
       throw fetchError;
     }

      if (!getRes.ok) {
        await getRes.body?.cancel();
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
    logger.error({ err: error, provider }, "listKeysWithOwnership error");
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during key listing",
    };
  }
}
