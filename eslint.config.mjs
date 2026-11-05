import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored React Bits components, installed through the shadcn registry.
    // They are recoloured to our tokens but otherwise upstream code, and they
    // predate the React Compiler lint rules. Our own wrappers around them
    // (twin-bits.tsx, use-bits-theme.ts) are linted normally.
    "src/components/bits/*.tsx",
    "!src/components/bits/twin-bits.tsx",
  ]),
]);

export default eslintConfig;
