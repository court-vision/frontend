import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { GeistSans } from "geist/font/sans";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-brand",
  weight: ["700"],
});

import { ThemeProvider } from "@/components/theme-provider";
import { TeamsProvider } from "./context/TeamsContext";
import { LineupProvider } from "./context/LineupContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { CommandPaletteProvider } from "@/providers/CommandPaletteProvider";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import Layout from "@/components/Base";

import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

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

        <body className={`${inter.variable} ${jetbrainsMono.variable} ${GeistSans.variable} ${spaceGrotesk.variable} font-sans`}>
          <QueryProvider>
            <TeamsProvider>
              <LineupProvider>
                <ThemeProvider
                  attribute="class"
                  defaultTheme="dark"
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
