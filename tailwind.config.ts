import type { Config } from "tailwindcss";

// Only Tailwind's preflight reset is used (`@tailwind base` in globals.css):
// every component styles itself with a CSS module and the desk tokens, so there
// is no theme, no utilities and no plugins here.
const config = {
  content: ["./src/**/*.{ts,tsx}"],
} satisfies Config;

export default config;
