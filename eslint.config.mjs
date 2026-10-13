import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  {
    ignores: [".claude/**", "src/types/generated/**"],
  },
  {
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // The browser loads @sentry/nextjs lazily (src/lib/report-error.ts): one
    // static import of it in client code puts the whole SDK back in every
    // route's first load. Type imports cost nothing.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/sentry-client.ts", "src/instrumentation.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@sentry/nextjs",
              message: "Report through captureError/recordBreadcrumb from @/lib/report-error.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
];

export default config;
