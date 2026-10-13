import type { Metadata, Viewport } from "next";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Outfit } from "next/font/google";
import { preconnect } from "react-dom";

import { DeskFrame } from "@/components/desk/DeskFrame";
import { deskMono, deskSans } from "@/components/desk/fonts";
import { API_BASE } from "@/endpoints";
import { QueryProvider } from "@/providers/QueryProvider";
import "./globals.css";

// The wordmark's face. Everything else is the desks' Geist (desk/fonts.ts).
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.courtvision.dev"),
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
  authors: [{ name: "Court Vision", url: "https://www.courtvision.dev" }],
  creator: "Court Vision",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.courtvision.dev",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Extend under the iOS home indicator / notch.
  viewportFit: "cover",
  // Midnight, the default desk theme; each theme sets its own color-scheme.
  themeColor: "#0f1729",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // A desk's first API call waits on hydration and clerk-js; open the API's
  // connection (DNS, TCP, TLS: 45-80 ms measured 2026-10-13) while that loads.
  // Anonymous because fetchJson's cross-origin requests use the default
  // credentials mode, which the browser serves from its uncredentialed pool.
  preconnect(API_BASE, { crossOrigin: "anonymous" });

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Court Vision",
              url: "https://www.courtvision.dev",
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

      <body className={`${outfit.variable} ${deskSans.variable} ${deskMono.variable}`}>
        <QueryProvider>
          {/* Every page is a desk-framed page: the desks, the landing, sign-in, errors.
              Clerk wraps only the pages that use it: (desk)/layout.tsx. */}
          <DeskFrame>{children}</DeskFrame>
        </QueryProvider>

        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
