import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { Prisma } from "@/generated/prisma/client";
import { type OAuthProvider } from "./constants";
import { invalidateUsageCaches, invalidateProxyModelsCache } from "@/lib/cache";
import {
  fetchWithTimeout,
  MANAGEMENT_BASE_URL,
  MANAGEMENT_API_KEY,
  FETCH_TIMEOUT_MS,
  isRecord,
  type ContributeOAuthResult,
  type RemoveOAuthResult,
  type ListOAuthResult,
  type ImportOAuthResult,
  type ToggleOAuthResult,
  type OAuthAccountWithOwnership,
} from "./management-api";

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
    logger.error({ err: error, provider }, "contributeOAuthAccount error");
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during OAuth registration",
    };
  }
}

export async function importOAuthCredential(
  userId: string,
  provider: string,
  fileName: string,
  fileContent: string
): Promise<ImportOAuthResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

  try {
    // Validate JSON content
    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(fileContent);
    } catch {
      return { ok: false, error: "Invalid JSON content" };
    }

    if (!parsedContent || typeof parsedContent !== "object" || Array.isArray(parsedContent)) {
      return { ok: false, error: "Credential file must contain a JSON object, not an array" };
    }

    // Build multipart form data to upload to CLIProxyAPIPlus
    const blob = new Blob([fileContent], { type: "application/json" });
    const formData = new FormData();
    formData.append("file", blob, fileName);

    const endpoint = `${MANAGEMENT_BASE_URL}/auth-files`;

    // Snapshot existing auth file names before upload to diff later
    const preExistingNames = new Set<string>();
    try {
      const snapshotRes = await fetchWithTimeout(endpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
      });
      if (snapshotRes.ok) {
        const snapshotData = await snapshotRes.json();
        if (isRecord(snapshotData) && Array.isArray(snapshotData.files)) {
          for (const f of snapshotData.files) {
            if (isRecord(f) && typeof f.name === "string") {
              preExistingNames.add(f.name);
            }
          }
        }
      } else {
        await snapshotRes.body?.cancel();
      }
    } catch {
      // Non-fatal: we'll fall back to name-based matching if snapshot fails
    }
    let uploadRes: Response;
    try {
      uploadRes = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
        body: formData,
      });
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        logger.error({
          err: fetchError,
          endpoint,
          provider,
          timeoutMs: FETCH_TIMEOUT_MS,
        }, "Fetch timeout - importOAuthCredential POST");
        return { ok: false, error: "Request timeout uploading credential file" };
      }
      throw fetchError;
    }

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text().catch(() => "");
      await uploadRes.body?.cancel();
      logger.warn(
        { provider, status: uploadRes.status, errorText },
        "importOAuthCredential: upload failed"
      );
      if (uploadRes.status === 409) {
        return { ok: false, error: "Credential file already exists" };
      }
      return { ok: false, error: `Failed to upload credential file: HTTP ${uploadRes.status}${errorText ? ` - ${errorText}` : ""}` };
    }

    // Poll auth-files to find the newly created file and claim ownership
    const MAX_RETRIES = 8;
    const RETRY_DELAY_MS = 1500;
    let claimedAccountName: string | null = null;
    let claimedEmail: string | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

      let getRes: Response;
      try {
        getRes = await fetchWithTimeout(`${endpoint}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
        });
      } catch {
        continue;
      }

      if (!getRes.ok) {
        await getRes.body?.cancel();
        continue;
      }

      const getData = await getRes.json();
      if (!isRecord(getData) || !Array.isArray(getData.files)) {
        continue;
      }

      const files = getData.files as Array<{
        name: string;
        provider?: string;
        type?: string;
        email?: string;
      }>;

      // Only consider files that did NOT exist before our upload
      const newFiles = files.filter((file) => !preExistingNames.has(file.name));

      // Primary: match new files by filename
      const matchingFile = newFiles.find((file) => {
        return file.name === fileName ||
          file.name.includes(fileName.replace(/\.json$/i, ""));
      });

      // Fallback: if snapshot was available and there's exactly one new file
      // matching the provider, use it (refuse if ambiguous)
      let fallbackFile: (typeof newFiles)[number] | null = null;
      if (!matchingFile && preExistingNames.size > 0) {
        const providerMatches = newFiles.filter((file) => {
          const fileProvider = (file.provider || file.type || "").toLowerCase();
          return fileProvider === provider.toLowerCase();
        });
        if (providerMatches.length === 1) {
          fallbackFile = providerMatches[0];
        }
      }

      const resolvedFile = matchingFile || fallbackFile;

      if (resolvedFile) {
        claimedAccountName = resolvedFile.name;
        claimedEmail = resolvedFile.email || null;
        break;
      }
    }

    if (!claimedAccountName) {
      // Upload succeeded but we couldn't find the file to claim
      // This is not a hard failure — the credential was imported
      logger.warn(
        { provider, fileName },
        "importOAuthCredential: uploaded but could not find file to claim ownership"
      );
      invalidateUsageCaches();
      invalidateProxyModelsCache();
      return { ok: true, accountName: fileName };
    }

    // Create ownership record in dashboard DB
    try {
      const ownership = await prisma.providerOAuthOwnership.create({
        data: {
          userId,
          provider,
          accountName: claimedAccountName,
          accountEmail: claimedEmail,
        },
      });
      invalidateUsageCaches();
      invalidateProxyModelsCache();
      return { ok: true, id: ownership.id, accountName: claimedAccountName };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return { ok: false, error: "Credential already imported and claimed" };
      }
      throw e;
    }
  } catch (error) {
    logger.error({ err: error, provider, fileName }, "importOAuthCredential error");
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during credential import",
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
          logger.error({
            err: fetchError,
            endpoint,
            timeoutMs: FETCH_TIMEOUT_MS,
          }, "Fetch timeout - listOAuthWithOwnership GET");
         return { ok: false, error: "Request timeout fetching OAuth accounts" };
       }
       throw fetchError;
     }

      if (!getRes.ok) {
        await getRes.body?.cancel();
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
      status?: string;
      status_message?: string;
      unavailable?: boolean;
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
         status: file.status || "active",
         statusMessage: file.status_message || null,
         unavailable: file.unavailable ?? false,
       };
     });

    return { ok: true, accounts: accountsWithOwnership };
  } catch (error) {
    logger.error({ err: error }, "listOAuthWithOwnership error");
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

  // Try to find by accountName (management API file ID)
  const byName = await prisma.providerOAuthOwnership.findUnique({
    where: { accountName: idOrName },
    select: { id: true, userId: true, accountName: true },
  });

  if (byName) {
    return {
      accountName: byName.accountName,
      ownership: { id: byName.id, userId: byName.userId },
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
          logger.error({
            err: fetchError,
            endpoint,
            accountName,
            timeoutMs: FETCH_TIMEOUT_MS,
          }, "Fetch timeout - removeOAuthAccount DELETE");
         return { ok: false, error: "Request timeout removing OAuth account" };
       }
       throw fetchError;
     }

      if (!deleteRes.ok) {
        await deleteRes.body?.cancel();
        return { ok: false, error: `Failed to remove OAuth account: HTTP ${deleteRes.status}` };
      }

    if (ownership) {
      await prisma.providerOAuthOwnership.delete({ where: { accountName } });
    }

    return { ok: true };
  } catch (error) {
    logger.error({ err: error, accountName }, "removeOAuthAccount error");
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
          logger.error({
            err: fetchError,
            endpoint,
            accountName: resolved.accountName,
            timeoutMs: FETCH_TIMEOUT_MS,
          }, "Fetch timeout - removeOAuthAccountByIdOrName DELETE");
         return { ok: false, error: "Request timeout removing OAuth account" };
       }
       throw fetchError;
     }

      if (!deleteRes.ok) {
        await deleteRes.body?.cancel();
        return { ok: false, error: `Failed to remove OAuth account: HTTP ${deleteRes.status}` };
      }

    // Clean up DB record if it exists
    if (resolved.ownership) {
      try {
        await prisma.providerOAuthOwnership.delete({
          where: { id: resolved.ownership.id },
        });
      } catch (e) {
        logger.error({ err: e, ownershipId: resolved.ownership.id }, "Failed to delete ownership record");
      }
    }

    return { ok: true };
  } catch (error) {
    logger.error({ err: error, idOrName }, "removeOAuthAccountByIdOrName error");
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during OAuth removal",
    };
  }
}

export async function toggleOAuthAccountByIdOrName(
  userId: string,
  idOrName: string,
  disabled: boolean,
  isAdmin: boolean
): Promise<ToggleOAuthResult> {
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
      // No DB ownership - only admin can toggle
      if (!isAdmin) {
        return { ok: false, error: "Access denied" };
      }
    }

    const endpoint = `${MANAGEMENT_BASE_URL}/auth-files?name=${encodeURIComponent(resolved.accountName)}`;

    let postRes: Response;
    try {
      postRes = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        },
        body: JSON.stringify({
          name: resolved.accountName,
          disabled,
        }),
      });
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        logger.error({
          err: fetchError,
          endpoint,
          accountName: resolved.accountName,
          timeoutMs: FETCH_TIMEOUT_MS,
        }, "Fetch timeout - toggleOAuthAccountByIdOrName POST");
        return { ok: false, error: "Request timeout toggling OAuth account" };
      }
      throw fetchError;
    }

    if (!postRes.ok) {
      const errorBody = await postRes.text().catch(() => "");
      await postRes.body?.cancel();
      return { ok: false, error: `Failed to toggle OAuth account: HTTP ${postRes.status}${errorBody ? ` - ${errorBody}` : ""}` };
    }

    return { ok: true, disabled };
  } catch (error) {
    logger.error({ err: error, idOrName, disabled }, "toggleOAuthAccountByIdOrName error");
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error during OAuth toggle",
    };
  }
}
