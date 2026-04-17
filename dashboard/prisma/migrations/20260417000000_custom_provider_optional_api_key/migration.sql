-- Make apiKeyHash nullable so providers can be created without an API key
-- (e.g. local Ollama / LM Studio / llama.cpp instances).
-- Column is camelCase because CustomProvider.apiKeyHash has no @map directive;
-- the original table (20260208_add_custom_providers) created it as "apiKeyHash".
ALTER TABLE "custom_providers" ALTER COLUMN "apiKeyHash" DROP NOT NULL;
