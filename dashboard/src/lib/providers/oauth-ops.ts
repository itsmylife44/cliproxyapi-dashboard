import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { Prisma } from "@/generated/prisma/client";
import { canonicalizeOAuthProvider, type OAuthProvider } from "./constants";
import { normalizeImportedOAuthCredential } from "./oauth-import-normalization";
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
  type OAuthAccountQuotaGroupState,
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
      where: { provider_accountName: { provider, accountName } },
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
    const normalizedCredential = normalizeImportedOAuthCredential(
      provider as OAuthProvider,
      fileContent
    );
    if (!normalizedCredential.ok) {
      return { ok: false, error: normalizedCredential.error };
    }

    // Build multipart form data to upload to CLIProxyAPIPlus
    const blob = new Blob([normalizedCredential.normalizedContent], { type: "application/json" });
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
          fallbackFile = providerMatches[0] ?? null;
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

    const quotaGroupsByAuthId = new Map<string, OAuthAccountQuotaGroupState[]>();
    try {
      const quotaGroupsEndpoint = `${MANAGEMENT_BASE_URL}/auth-files/quota-groups`;
      const quotaGroupsRes = await fetchWithTimeout(quotaGroupsEndpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
      });
      if (quotaGroupsRes.ok) {
        const quotaGroupsData = await quotaGroupsRes.json();
        if (isRecord(quotaGroupsData) && Array.isArray(quotaGroupsData.items)) {
          for (const raw of quotaGroupsData.items) {
            if (!isRecord(raw) || typeof raw.auth_id !== "string" || typeof raw.group_id !== "string") {
              continue;
            }
            const authId = raw.auth_id;
            const items = quotaGroupsByAuthId.get(authId) ?? [];
            items.push({
              authId,
              groupId: String(raw.group_id),
              label: typeof raw.label === "string" ? raw.label : String(raw.group_id),
              effectiveStatus: typeof raw.effective_status === "string" ? raw.effective_status : "available",
              manualSuspended: raw.manual_suspended === true,
              manualReason: typeof raw.manual_reason === "string" ? raw.manual_reason : null,
              autoSuspendedUntil:
                typeof raw.auto_suspended_until === "string" ? raw.auto_suspended_until : null,
              autoReason: typeof raw.auto_reason === "string" ? raw.auto_reason : null,
              sourceModel: typeof raw.source_model === "string" ? raw.source_model : null,
              sourceProvider: typeof raw.source_provider === "string" ? raw.source_provider : null,
              resetTimeSource: typeof raw.reset_time_source === "string" ? raw.reset_time_source : null,
              updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
              updatedBy: typeof raw.updated_by === "string" ? raw.updated_by : null,
            });
            quotaGroupsByAuthId.set(authId, items);
          }
        }
      } else {
        await quotaGroupsRes.body?.cancel();
      }
    } catch (error) {
      logger.warn({ err: error }, "listOAuthWithOwnership: failed to fetch quota groups");
    }

    // Build ownership lookup rows using canonical provider identifiers. Every
    // write path (claim route, cascade, migration) canonicalizes before insert,
    // so an auth file whose raw provider does not canonicalize cannot have an
    // ownership row. Skipping such files from the DB query is therefore lossless:
    // the `ownership` lookup would return undefined anyway, and the UI already
    // renders the raw provider string verbatim (see `provider` field below).
    const authFileLookups = authFiles.map((file) => {
      const rawProvider = file.provider || file.type || "";
      const canonical = canonicalizeOAuthProvider(rawProvider);
      return { file, canonical };
    });

    const ownershipFilters = authFileLookups
      .filter((entry): entry is { file: typeof entry.file; canonical: OAuthProvider } => entry.canonical !== null)
      .map(({ file, canonical }) => ({ provider: canonical, accountName: file.name }));

    const ownerships = ownershipFilters.length === 0
      ? []
      : await prisma.providerOAuthOwnership.findMany({
          where: { OR: ownershipFilters },
          include: { user: { select: { id: true, username: true } } },
        });

    const ownershipMap = new Map(
      ownerships.map((o) => [`${o.provider}:${o.accountName}`, o] as const)
    );

     const accountsWithOwnership: OAuthAccountWithOwnership[] = authFileLookups.map(({ file, canonical }, index) => {
       const ownership = canonical ? ownershipMap.get(`${canonical}:${file.name}`) : undefined;
       const isOwn = ownership?.userId === userId;
       const canSeeDetails = isOwn || isAdmin;

       return {
         id: canSeeDetails ? file.id : `account-${index + 1}`,
         authId: canSeeDetails ? file.id : null,
         accountName: canSeeDetails ? file.name : `Account ${index + 1}`,
         accountEmail: canSeeDetails ? file.email || null : null,
         provider: file.provider || file.type || "unknown",
         ownerUsername: canSeeDetails ? ownership?.user.username || null : null,
         ownerUserId: canSeeDetails ? ownership?.user.id || null : null,
         isOwn,
         status: file.status || "active",
         statusMessage: file.status_message || null,
         unavailable: file.unavailable ?? false,
         quotaGroups: canSeeDetails ? quotaGroupsByAuthId.get(file.id) ?? [] : [],
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

export async function setOAuthQuotaGroupManualByAuthId(
  authId: string,
  groupId: string,
  manualSuspended: boolean,
  reason?: string
): Promise<ToggleOAuthResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

  try {
    const endpoint = `${MANAGEMENT_BASE_URL}/auth-files/quota-groups/manual`;
    const response = await fetchWithTimeout(endpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_id: authId,
        group_id: groupId,
        manual_suspended: manualSuspended,
        reason: reason ?? "",
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { ok: false, error: `Failed to update quota group: HTTP ${response.status}` };
    }
    invalidateUsageCaches();
    invalidateProxyModelsCache();
    return { ok: true };
  } catch (error) {
    logger.error({ err: error, authId, groupId, manualSuspended }, "setOAuthQuotaGroupManualByAuthId error");
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error updating quota group",
    };
  }
}

export async function clearOAuthQuotaGroupCooldownByAuthId(
  authId: string,
  groupId: string
): Promise<ToggleOAuthResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

  try {
    const endpoint = `${MANAGEMENT_BASE_URL}/auth-files/quota-groups/auto/clear`;
    const response = await fetchWithTimeout(endpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_id: authId,
        group_id: groupId,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { ok: false, error: `Failed to clear cooldown: HTTP ${response.status}` };
    }
    invalidateUsageCaches();
    invalidateProxyModelsCache();
    return { ok: true };
  } catch (error) {
    logger.error({ err: error, authId, groupId }, "clearOAuthQuotaGroupCooldownByAuthId error");
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error clearing quota cooldown",
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

  // Try to find by accountName (management API file ID).
  // After scoping ownership by (provider, accountName), the same accountName can
  // legitimately exist across providers. We accept the first match and warn if
  // more than one exists so ambiguous callers are visible in logs.
  const byNameMatches = await prisma.providerOAuthOwnership.findMany({
    where: { accountName: idOrName },
    select: { id: true, userId: true, accountName: true, provider: true },
    take: 2,
  });

  const byName = byNameMatches[0];
  if (byNameMatches.length > 1) {
    logger.warn(
      { accountName: idOrName, matchCount: byNameMatches.length },
      "resolveOAuthAccountByIdOrName: ambiguous accountName spans multiple providers; returning first"
    );
  }

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
  provider: string,
  accountName: string,
  isAdmin: boolean
): Promise<RemoveOAuthResult> {
  if (!MANAGEMENT_API_KEY) {
    return { ok: false, error: "Management API key not configured" };
  }

  try {
    const ownership = await prisma.providerOAuthOwnership.findUnique({
      where: { provider_accountName: { provider, accountName } },
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
      await prisma.providerOAuthOwnership.delete({
        where: { provider_accountName: { provider, accountName } },
      });
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
