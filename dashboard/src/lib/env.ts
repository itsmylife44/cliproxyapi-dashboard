import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid URL")
    .startsWith("postgresql://", "DATABASE_URL must be a PostgreSQL connection string"),
  
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),
  
  MANAGEMENT_API_KEY: z
    .string()
    .min(16, "MANAGEMENT_API_KEY must be at least 16 characters long"),
  
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
    .default("7d"),
  
  CLIPROXYAPI_CONTAINER_NAME: z
    .string()
    .default("cliproxyapi"),
  
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

let _validated = false;
let _env: Env | null = null;

function getEnv(): Env {
  if (_env !== null) return _env;
  
  const isBuildTime = process.env.npm_lifecycle_event === "build" ||
    process.env.DATABASE_URL?.startsWith("postgresql://build:");
  
  if (isBuildTime) {
    _env = {
      DATABASE_URL: "postgresql://build:build@localhost:5432/build",
      JWT_SECRET: "build-time-placeholder-secret-32chars!",
      MANAGEMENT_API_KEY: "build-time-placeholder",
      CLIPROXYAPI_MANAGEMENT_URL: "http://localhost:8317/v0/management",
      NODE_ENV: "production",
      TZ: "UTC",
      JWT_EXPIRES_IN: "7d",
      CLIPROXYAPI_CONTAINER_NAME: "cliproxyapi",
      LOG_LEVEL: "info",
    };
    return _env;
  }
  
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    
    console.error("❌ Environment validation failed:\n" + errors);
    throw new Error(
      `Invalid environment variables:\n${errors}\n\n` +
      "Please check your .env file or environment configuration."
    );
  }
  
  _env = result.data;
  _validated = true;
  return _env;
}

export const env = new Proxy({} as Env, {
  get(_, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
