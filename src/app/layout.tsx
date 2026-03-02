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
  metadataBase: new URL("https://courtvision.dev"),
  title: {
    default: "Court Vision",
    template: "%s | Court Vision",
  },
  description:
    "Advanced fantasy basketball analytics. Player rankings, lineup optimization, matchup analysis, and streaming recommendations to help you win your league.",
  keywords: [
    "fantasy basketball",
    "fantasy basketball analytics",
    "NBA player rankings",
    "lineup optimizer",
    "fantasy basketball tools",
    "matchup analysis",
    "streaming recommendations",
    "NBA fantasy",
  ],
  authors: [{ name: "Court Vision", url: "https://courtvision.dev" }],
  creator: "Court Vision",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://courtvision.dev",
    siteName: "Court Vision",
    title: "Court Vision – Fantasy Basketball Analytics",
    description:
      "Advanced fantasy basketball analytics. Player rankings, lineup optimization, matchup analysis, and streaming recommendations to help you win your league.",
    images: [
      {
        url: "/logo-dark.png",
        width: 1200,
        height: 630,
        alt: "Court Vision – Fantasy Basketball Analytics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Court Vision – Fantasy Basketball Analytics",
    description:
      "Advanced fantasy basketball analytics. Player rankings, lineup optimization, matchup analysis, and streaming recommendations to help you win your league.",
    images: ["/logo-dark.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark" suppressHydrationWarning>
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "Court Vision",
                url: "https://courtvision.dev",
                description:
                  "Advanced fantasy basketball analytics platform. Player rankings, lineup optimization, matchup analysis, and streaming recommendations.",
                applicationCategory: "SportsApplication",
                operatingSystem: "Web",
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "USD",
                },
              }),
            }}
          />
        </head>

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
