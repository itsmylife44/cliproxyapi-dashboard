import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Single sources of truth; tests may stub or assert the raw values.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/management-url.ts", "src/lib/error-codes.ts", "**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[property.name='CLIPROXYAPI_MANAGEMENT_URL'], MemberExpression[property.value='CLIPROXYAPI_MANAGEMENT_URL']",
          message: "Read the management URL via @/lib/management-url.",
        },
        {
          selector:
            "Literal[value='PROXY_VERSION_PIN_UNAVAILABLE'], TemplateElement[value.raw='PROXY_VERSION_PIN_UNAVAILABLE']",
          message: "Use ERROR_CODE.PROXY_VERSION_PIN_UNAVAILABLE from @/lib/error-codes.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
