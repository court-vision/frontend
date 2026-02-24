import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Player Rankings",
  description:
    "Fantasy basketball player rankings updated daily. Sort by total fantasy points, per-game averages, and category breakdowns to find the best players for your lineup.",
  openGraph: {
    title: "Player Rankings | Court Vision",
    description:
      "Fantasy basketball player rankings updated daily. Sort by total fantasy points, per-game averages, and category breakdowns to find the best players for your lineup.",
    url: "https://www.courtvision.dev/rankings",
  },
  twitter: {
    title: "Player Rankings | Court Vision",
    description:
      "Fantasy basketball player rankings updated daily. Sort by total fantasy points, per-game averages, and category breakdowns to find the best players for your lineup.",
  },
};

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
