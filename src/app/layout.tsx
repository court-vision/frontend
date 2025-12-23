import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/react";

import { Inter } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "./context/AuthContext";
import { TeamsProvider } from "./context/TeamsContext";
import { LineupProvider } from "./context/LineupContext";
import { QueryProvider } from "@/providers/QueryProvider";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import Layout from "@/components/Base";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head></head>

      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <TeamsProvider>
              <LineupProvider>
                <ThemeProvider
                  attribute="class"
                  defaultTheme="dark"
                  enableSystem={false}
                >
                  <Layout>{children}</Layout>
                  <Toaster richColors />
                </ThemeProvider>
              </LineupProvider>
            </TeamsProvider>
          </AuthProvider>
        </QueryProvider>

        <Analytics />
      </body>
    </html>
  );
}
