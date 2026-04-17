-- Make api_key_hash nullable so providers can be created without an API key
-- (e.g. local Ollama / LM Studio / llama.cpp instances).
ALTER TABLE "custom_providers" ALTER COLUMN "api_key_hash" DROP NOT NULL;
