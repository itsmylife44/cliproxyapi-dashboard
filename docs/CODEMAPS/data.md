<!-- Generated: 2026-03-07 | Models: 18 | Token estimate: ~500 -->
# Data Model (Prisma + PostgreSQL)

## Core Models
```
User (id, username, passwordHash, isAdmin, sessionVersion, createdAt, updatedAt)
  ├──< ModelPreference (userId, excludedModels[])
  ├──< AgentModelOverride (userId, overrides JSON)
  ├──< SyncToken (userId, name, tokenHash, syncApiKey?, lastUsedAt?, revokedAt?)
  ├──< UserApiKey (userId, key, name, lastUsedAt?)
  ├──< ConfigTemplate (userId, name, shareCode, isActive)
  ├──< ConfigSubscription (userId, templateId, isActive, frozenConfig?, previousConfig?)
  ├──< ProviderKeyOwnership (userId, provider, keyIdentifier, name, keyHash)
  ├──< ProviderOAuthOwnership (userId, provider, accountName, accountEmail?)
  ├──< AuditLog (userId, action, target?, metadata?, ipAddress?)
  └──< UsageRecord (userId?, apiKeyId?, authIndex, model, source, timestamp,
                     inputTokens, outputTokens, reasoningTokens, cachedTokens,
                     totalTokens, failed, collectedAt)
```

## Provider Models
```
CustomProvider (id, userId, name, providerId, baseUrl, apiKeyHash, groupId?, sortOrder,
               prefix?, proxyUrl?, headers?)
  ├──< CustomProviderModel (customProviderId, upstreamName, alias)
  └──< CustomProviderExcludedModel (customProviderId, pattern)

ProviderGroup (id, userId, name, color?, sortOrder, isActive)
  └──< CustomProvider (groupId)

PerplexityCookie (id, userId, cookieData, label, isActive, lastUsedAt?)
```

## System Models
```
SystemSetting (id, key, value)
CollectorState (id, lastCollectedAt, lastStatus, recordsStored, errorMessage?)
```

## Key Indexes
- User: username (unique)
- SyncToken: userId (index), tokenHash (index)
- UserApiKey: key (unique), userId (index)
- UsageRecord: authIndex+model+timestamp+source+totalTokens (unique dedup),
  userId, authIndex, timestamp, model, source, userId+timestamp,
  authIndex+timestamp, collectedAt
- AuditLog: userId, createdAt, action, target
- ProviderKeyOwnership: keyHash (unique), userId, provider, provider+keyHash (composite)
- ProviderOAuthOwnership: accountName (unique), userId
- CustomProvider: providerId (unique), userId, groupId
- ProviderGroup: userId+name (unique), userId
- ConfigTemplate: shareCode (unique, indexed)

## Migrations
Located in dashboard/prisma/migrations/ (17 migrations)
Managed via `prisma migrate deploy` (production) / `prisma db push` (dev bootstrap)
