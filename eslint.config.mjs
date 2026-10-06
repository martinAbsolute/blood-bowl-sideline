import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { fixupConfigRules } from "@eslint/compat";

export default defineConfig([
  ...fixupConfigRules(nextCoreWebVitals),
  ...fixupConfigRules(nextTypescript),
  globalIgnores([
    "convex/_generated/**",
    ".research/**",
    ".agents/**",
    ".tmp/**",
    ".test-results/**",
    "artifacts/**",
    "coverage/**",
    "build/**",
    "out/**",
    ".vercel/**",
    "src/hooks/use-mobile.ts",
    "src/components/ui/**",
    "src/components/magic-ui/**",
  ]),
]);
