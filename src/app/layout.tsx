import type { Metadata, Viewport } from "next";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@clerk/nextjs";
import { Outfit } from "next/font/google";

import { DeskFrame } from "@/components/desk/DeskFrame";
import { deskMono, deskSans } from "@/components/desk/fonts";
import { ACCOUNT_DESK, WEEK_DESK } from "@/components/desk/routes";
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
        <ClerkProvider
          signInFallbackRedirectUrl={WEEK_DESK}
          signUpFallbackRedirectUrl={`${ACCOUNT_DESK}?add`}
          afterSignOutUrl="/"
        >
          <QueryProvider>
            {/* Every page is a desk-framed page: the desks, the landing, sign-in, errors. */}
            <DeskFrame>{children}</DeskFrame>
          </QueryProvider>
        </ClerkProvider>

        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
