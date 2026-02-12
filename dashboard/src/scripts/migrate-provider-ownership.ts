#!/usr/bin/env tsx

/**
 * Migration Script: Existing CLIProxyAPI Keys → Admin Ownership
 * 
 * Migrates existing provider API keys and OAuth accounts from CLIProxyAPI
 * to PostgreSQL ownership records, assigning all to the first admin user.
 * 
 * Usage:
 *   npm run migrate:provider-ownership          # Apply migration
 *   npm run migrate:provider-ownership --dry-run # Preview changes only
 */

import { createHash } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const PROVIDER = {
  CLAUDE: "claude",
  GEMINI: "gemini",
  CODEX: "codex",
  OPENAI_COMPAT: "openai-compatibility",
} as const;

const PROVIDER_ENDPOINT = {
  [PROVIDER.CLAUDE]: "/claude-api-key",
  [PROVIDER.GEMINI]: "/gemini-api-key",
  [PROVIDER.CODEX]: "/codex-api-key",
  [PROVIDER.OPENAI_COMPAT]: "/openai-compatibility",
} as const;

const OAUTH_PROVIDER = {
  CLAUDE: "claude",
  GEMINI_CLI: "gemini-cli",
  CODEX: "codex",
  ANTIGRAVITY: "antigravity",
  QWEN: "qwen",
  IFLOW: "iflow",
  KIMI: "kimi",
} as const;

function hashProviderKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

function maskProviderKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return apiKey;
  }
  const prefix = apiKey.slice(0, 8);
  const suffix = apiKey.slice(-4);
  return `${prefix}...${suffix}`;
}

if (!process.env.DATABASE_URL) {
  console.error("\n❌ ERROR: DATABASE_URL environment variable not set");
  console.error("   Set DATABASE_URL in your environment or .env file\n");
  process.exit(1);
}

if (!process.env.CLIPROXYAPI_MANAGEMENT_URL && !process.env.MANAGEMENT_API_KEY) {
  console.warn("\n⚠️  WARNING: Management API environment variables not set");
  console.warn("   CLIPROXYAPI_MANAGEMENT_URL and MANAGEMENT_API_KEY should be configured");
  console.warn("   Migration will continue but may not fetch remote keys\n");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });
const isDryRun = process.argv.includes("--dry-run");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

async function fetchManagementJson(endpoint: string): Promise<unknown> {
  try {
    const baseUrl = process.env.CLIPROXYAPI_MANAGEMENT_URL || "http://cliproxyapi:8317/v0/management";
    const res = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${process.env.MANAGEMENT_API_KEY}`,
      },
    });
    if (!res.ok) {
      console.warn(`⚠️  Management API ${endpoint} returned ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error(`❌ Failed to fetch ${endpoint}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function main() {
  console.log("\n🔄 Provider Ownership Migration");
  console.log("================================\n");

  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No database changes will be made\n");
  }

  // Step 1: Find first admin user
  console.log("📋 Step 1: Finding first admin user...");
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true },
  });

  if (!admin) {
    console.error("\n❌ ERROR: No admin user found in database");
    console.error("   Create an admin user first, then run this migration again.\n");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`✅ Found admin: ${admin.username} (ID: ${admin.id})\n`);

  let totalKeysCreated = 0;
  let totalOAuthCreated = 0;
  let totalKeysSkipped = 0;
  let totalOAuthSkipped = 0;

  // Step 2: Migrate API keys
  console.log("📋 Step 2: Migrating API keys...");

  const providerKeys = [
    { provider: PROVIDER.CLAUDE, endpoint: PROVIDER_ENDPOINT[PROVIDER.CLAUDE], responseKey: "claude-api-key" },
    { provider: PROVIDER.GEMINI, endpoint: PROVIDER_ENDPOINT[PROVIDER.GEMINI], responseKey: "gemini-api-key" },
    { provider: PROVIDER.CODEX, endpoint: PROVIDER_ENDPOINT[PROVIDER.CODEX], responseKey: "codex-api-key" },
  ];

  for (const { provider, endpoint, responseKey } of providerKeys) {
    const data = await fetchManagementJson(endpoint);
    if (!isRecord(data)) {
      console.log(`   ⏭️  ${provider}: No data available`);
      continue;
    }

    const keysArray = data[responseKey];
    if (!Array.isArray(keysArray)) {
      console.log(`   ⏭️  ${provider}: No keys found`);
      continue;
    }

    const apiKeys = keysArray
      .map((entry) => {
        if (!isRecord(entry)) return null;
        const apiKey = entry["api-key"];
        return typeof apiKey === "string" ? apiKey : null;
      })
      .filter((key): key is string => typeof key === "string");

    console.log(`   🔑 ${provider}: Found ${apiKeys.length} key(s)`);

    for (const apiKey of apiKeys) {
      const keyHash = hashProviderKey(apiKey);
      const keyIdentifier = maskProviderKey(apiKey);

      // Check if ownership already exists
      const existing = await prisma.providerKeyOwnership.findUnique({
        where: { keyHash },
      });

      if (existing) {
        console.log(`      ⏭️  ${keyIdentifier} - Already owned by user ${existing.userId}`);
        totalKeysSkipped++;
        continue;
      }

      if (isDryRun) {
        console.log(`      🔍 ${keyIdentifier} - Would assign to ${admin.username}`);
        totalKeysCreated++;
      } else {
        await prisma.providerKeyOwnership.create({
          data: {
            userId: admin.id,
            provider,
            keyIdentifier,
            keyHash,
          },
        });
        console.log(`      ✅ ${keyIdentifier} - Assigned to ${admin.username}`);
        totalKeysCreated++;
      }
    }
  }

  // Step 3: Migrate OpenAI-compatible keys
  console.log("\n📋 Step 3: Migrating OpenAI-compatible keys...");

  const openaiData = await fetchManagementJson(PROVIDER_ENDPOINT[PROVIDER.OPENAI_COMPAT]);
  if (!isRecord(openaiData)) {
    console.log("   ⏭️  openai-compatibility: No data available");
  } else {
    const openaiArray = openaiData["openai-compatibility"];
    if (!Array.isArray(openaiArray)) {
      console.log("   ⏭️  openai-compatibility: No providers found");
    } else {
      console.log(`   🔑 openai-compatibility: Found ${openaiArray.length} provider(s)`);

      for (const providerEntry of openaiArray) {
        if (!isRecord(providerEntry)) continue;

        const providerName = providerEntry.name;
        if (typeof providerName !== "string") continue;

        const apiKeyEntries = providerEntry["api-key-entries"];
        if (!Array.isArray(apiKeyEntries)) continue;

        console.log(`      📦 ${providerName}: ${apiKeyEntries.length} key(s)`);

        for (const keyEntry of apiKeyEntries) {
          if (!isRecord(keyEntry)) continue;

          const apiKey = keyEntry["api-key"];
          if (typeof apiKey !== "string") continue;

          const keyHash = hashProviderKey(apiKey);
          const keyIdentifier = maskProviderKey(apiKey);

          const existing = await prisma.providerKeyOwnership.findUnique({
            where: { keyHash },
          });

          if (existing) {
            console.log(`         ⏭️  ${keyIdentifier} - Already owned by user ${existing.userId}`);
            totalKeysSkipped++;
            continue;
          }

          if (isDryRun) {
            console.log(`         🔍 ${keyIdentifier} - Would assign to ${admin.username}`);
            totalKeysCreated++;
          } else {
            await prisma.providerKeyOwnership.create({
              data: {
                userId: admin.id,
                provider: PROVIDER.OPENAI_COMPAT,
                keyIdentifier,
                keyHash,
              },
            });
            console.log(`         ✅ ${keyIdentifier} - Assigned to ${admin.username}`);
            totalKeysCreated++;
          }
        }
      }
    }
  }

  // Step 4: Migrate OAuth accounts
  console.log("\n📋 Step 4: Migrating OAuth accounts...");

  const authData = await fetchManagementJson("/auth-files");
  if (!isRecord(authData)) {
    console.log("   ⏭️  auth-files: No data available");
  } else {
    const filesArray = authData.files;
    if (!Array.isArray(filesArray)) {
      console.log("   ⏭️  auth-files: No accounts found");
    } else {
      console.log(`   🔐 Found ${filesArray.length} OAuth account(s)`);

      for (const file of filesArray) {
        if (!isRecord(file)) continue;

        const accountName = file.name;
        if (typeof accountName !== "string") continue;

        const accountEmail = typeof file.email === "string" ? file.email : null;
        const providerType = typeof file.provider === "string" ? file.provider : (typeof file.type === "string" ? file.type : "unknown");

        // Normalize provider type to match OAUTH_PROVIDER constants
        let normalizedProvider = providerType;
        if (providerType === "claude") normalizedProvider = OAUTH_PROVIDER.CLAUDE;
        else if (providerType === "gemini-cli" || providerType === "gemini") normalizedProvider = OAUTH_PROVIDER.GEMINI_CLI;
        else if (providerType === "codex") normalizedProvider = OAUTH_PROVIDER.CODEX;
        else if (providerType === "antigravity") normalizedProvider = OAUTH_PROVIDER.ANTIGRAVITY;
        else if (providerType === "qwen") normalizedProvider = OAUTH_PROVIDER.QWEN;
        else if (providerType === "iflow") normalizedProvider = OAUTH_PROVIDER.IFLOW;
        else if (providerType === "kimi") normalizedProvider = OAUTH_PROVIDER.KIMI;

        const existing = await prisma.providerOAuthOwnership.findUnique({
          where: { accountName },
        });

        if (existing) {
          console.log(`      ⏭️  ${accountName} (${normalizedProvider}) - Already owned by user ${existing.userId}`);
          totalOAuthSkipped++;
          continue;
        }

        if (isDryRun) {
          console.log(`      🔍 ${accountName} (${normalizedProvider}) - Would assign to ${admin.username}`);
          totalOAuthCreated++;
        } else {
          await prisma.providerOAuthOwnership.create({
            data: {
              userId: admin.id,
              provider: normalizedProvider,
              accountName,
              accountEmail,
            },
          });
          console.log(`      ✅ ${accountName} (${normalizedProvider}) - Assigned to ${admin.username}`);
          totalOAuthCreated++;
        }
      }
    }
  }

  // Summary
  console.log("\n================================");
  console.log("📊 Migration Summary\n");
  console.log(`   API Keys:`);
  console.log(`      ${isDryRun ? "Would create" : "Created"}:  ${totalKeysCreated}`);
  console.log(`      Skipped (already owned): ${totalKeysSkipped}`);
  console.log(`\n   OAuth Accounts:`);
  console.log(`      ${isDryRun ? "Would create" : "Created"}:  ${totalOAuthCreated}`);
  console.log(`      Skipped (already owned): ${totalOAuthSkipped}`);
  console.log(`\n   Admin User: ${admin.username}`);
  console.log("================================\n");

  if (isDryRun) {
    console.log("✅ Dry run complete - No changes were made to the database");
    console.log("   Run without --dry-run to apply these changes\n");
  } else {
    console.log("✅ Migration complete\n");
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("\n❌ Migration failed with error:");
  console.error(error);
  prisma.$disconnect().finally(() => {
    process.exit(1);
  });
});
