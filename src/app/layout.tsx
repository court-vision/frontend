import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { Plus_Jakarta_Sans, JetBrains_Mono, Outfit } from "next/font/google";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["500", "600", "700", "800"],
});

import { ThemeProvider } from "@/components/theme-provider";
import { TeamsProvider } from "./context/TeamsContext";
import { LineupProvider } from "./context/LineupContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { CommandPaletteProvider } from "@/providers/CommandPaletteProvider";
import { ProviderThemeSync } from "@/components/ProviderThemeSync";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import Layout from "@/components/Base";

import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Court Vision",
  description: "Advanced tools to help you win your fantasy basketball league.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark" suppressHydrationWarning>
        <head></head>

        <body className={`${jakartaSans.variable} ${jetbrainsMono.variable} ${outfit.variable} font-sans`}>
          <QueryProvider>
            <TeamsProvider>
              <ProviderThemeSync />
              <LineupProvider>
                <ThemeProvider
                  attribute="class"
                  defaultTheme="dark"
                  forcedTheme="dark"
                  enableSystem={false}
                >
                  <CommandPaletteProvider>
                    <Layout>{children}</Layout>
                    <Toaster richColors />
                  </CommandPaletteProvider>
                </ThemeProvider>
              </LineupProvider>
            </TeamsProvider>
          </QueryProvider>

          <SpeedInsights />
          <Analytics />

        </body>
      </html>
    </ClerkProvider>
  );
}
