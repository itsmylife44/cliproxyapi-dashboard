import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid URL")
    .startsWith("postgresql://", "DATABASE_URL must be a PostgreSQL connection string"),
  
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long")
    .describe("Secret key for JWT signing"),
  
  MANAGEMENT_API_KEY: z
    .string()
    .min(16, "MANAGEMENT_API_KEY must be at least 16 characters long")
    .describe("API key for CLIProxyAPI management API authentication"),
  
  CLIPROXYAPI_MANAGEMENT_URL: z
    .string()
    .url("CLIPROXYAPI_MANAGEMENT_URL must be a valid URL")
    .default("http://cliproxyapi:8317/v0/management"),
  
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  
  TZ: z
    .string()
    .default("UTC"),
  
  JWT_EXPIRES_IN: z
    .string()
    .default("7d")
    .describe("JWT token expiration time"),
  
  CLIPROXYAPI_CONTAINER_NAME: z
    .string()
    .default("cliproxyapi"),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".");
        const message = issue.message;
        return `  ${path}: ${message}`;
      })
      .join("\n");
    
    console.error("❌ Environment validation failed:\n" + errors);
    throw new Error(
      `Invalid environment variables:\n${errors}\n\n` +
      "Please check your .env file or environment configuration."
    );
  }
  
  return result.data;
}

export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
