import { defineConfig } from "prisma/config";

const BUILD_TIME_DATABASE_URL = "postgresql://build:build@localhost:5432/build";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Prisma client generation only needs a syntactically valid URL.
    // Falling back here keeps local builds reproducible without real DB secrets.
    url: process.env.DATABASE_URL || BUILD_TIME_DATABASE_URL,
  },
});
