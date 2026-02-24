import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics Terminal",
  description:
    "Bloomberg Terminal-inspired analytics for fantasy basketball. Deep-dive into player stats, trends, advanced metrics, and head-to-head comparisons.",
  openGraph: {
    title: "Analytics Terminal | Court Vision",
    description:
      "Bloomberg Terminal-inspired analytics for fantasy basketball. Deep-dive into player stats, trends, advanced metrics, and head-to-head comparisons.",
    url: "https://www.courtvision.dev/terminal",
  },
  twitter: {
    title: "Analytics Terminal | Court Vision",
    description:
      "Bloomberg Terminal-inspired analytics for fantasy basketball. Deep-dive into player stats, trends, advanced metrics, and head-to-head comparisons.",
  },
};

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
