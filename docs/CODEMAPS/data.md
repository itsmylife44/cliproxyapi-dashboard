<!-- Generated: 2026-03-07 | Models: 18 | Token estimate: ~500 -->
# Data Model (Prisma + PostgreSQL)

## Core Models
```
User (id, username, passwordHash, isAdmin, sessionVersion, createdAt)
  ├──< ModelPreference (userId, excludedModels[])
  ├──< AgentModelOverride (userId, agentConfig JSON)
  ├──< SyncToken (userId, name, tokenHash, apiKeyId?)
  ├──< UserApiKey (userId, keyHash, name, isActive)
  ├──< ConfigTemplate (userId, name, content, shareCode)
  ├──< ConfigSubscription (userId, templateId)
  ├──< ProviderKeyOwnership (userId, provider, keyHash, name)
  ├──< ProviderOAuthOwnership (userId, provider, accountId)
  ├──< AuditLog (userId, action, target, details, ip)
  └──< UsageRecord (userId?, apiKeyHash, model, tokens, cost, collectedAt)
```

## Provider Models
```
CustomProvider (id, userId, name, providerId, baseUrl, apiKey, groupId?, position)
  ├──< CustomProviderModel (providerId, modelId, mappedTo)
  └──< CustomProviderExcludedModel (providerId, pattern)

ProviderGroup (id, userId, name, position, isActive)
  └──< CustomProvider (groupId)

PerplexityCookie (id, userId, cookie, expiresAt, isActive)
```

## System Models
```
SystemSetting (key, value)
CollectorState (id, lastCollectedAt)
```

## Key Indexes
- User: username (unique)
- SyncToken: tokenHash (unique)
- UserApiKey: keyHash (unique)
- UsageRecord: collectedAt, apiKeyHash
- AuditLog: target, userId
- ProviderKeyOwnership: provider+keyHash (composite)

## Migrations
Located in dashboard/prisma/migrations/ (17 migrations)
Managed via `prisma migrate deploy` (production) / `prisma db push` (dev bootstrap)
