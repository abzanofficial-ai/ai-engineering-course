import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Files allowed to inject HTML: they render only importer output (raw HTML disabled), never user text. ADR-0018.
const HTML_RENDERERS = [
  "src/components/section-blocks.tsx",
  "src/app/learn/**/page.tsx",
  "src/app/layout.tsx",
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
];

export default config;
