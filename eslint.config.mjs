import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Files allowed to inject HTML: they render only importer output (raw HTML disabled), never user text. ADR-0018.
const HTML_RENDERERS = [
  "src/components/route-view.tsx",
  "src/components/chapter/**/*.tsx",
  "src/components/checkpoint-flow.tsx",
  "src/components/search-view.tsx",
  "src/components/term-popover.tsx",
  "src/app/learn/**/page.tsx",
  "src/app/layout.tsx",
  "src/app/page.tsx", // JSON-LD only, escaped (landing page)
];

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      ".content/**",
      ".cache/**",
      "public/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "Only importer output may be rendered as HTML (ADR-0018). Render user text as text.",
        },
      ],
    },
  },
  { files: HTML_RENDERERS, rules: { "no-restricted-syntax": "off" } },
  {
    // ADR-0023: personal data is reached only through src/server/repo/*, which applies the
    // tenant and user scope. Everything else must not import the database client.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/server/repo/**",
      "src/server/db/**",
      "src/server/auth-config.ts",
      "src/server/rate-limit.ts",
      "src/app/api/health/route.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db/client", "@/server/db/client"],
              message: "Use a repository in src/server/repo (tenant-scoped, ADR-0023).",
            },
            {
              group: ["**/db/schema", "@/server/db/schema"],
              message: "Use a repository in src/server/repo (tenant-scoped, ADR-0023).",
            },
          ],
        },
      ],
    },
  },
];

export default config;
