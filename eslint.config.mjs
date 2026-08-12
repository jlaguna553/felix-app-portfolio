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
  ]),
  // react-hooks v5 added strict experimental rules that flag valid intentional
  // patterns used throughout this codebase (async data loading, cookie setting,
  // drag refs in JSX, Date.now() for real-time display). Disable them until we
  // adopt the new patterns incrementally.
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability':        'off',
      'react-hooks/refs':                'off',
      'react-hooks/purity':              'off',
    },
  },
]);

export default eslintConfig;
