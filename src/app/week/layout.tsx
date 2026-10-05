import { Geist, Geist_Mono } from "next/font/google";

// The /week prototype's own type: Geist for text, Geist Mono for every number.
const sans = Geist({ subsets: ["latin"], variable: "--tt-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--tt-mono", display: "swap" });

export default function WeekLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${sans.variable} ${mono.variable}`}>{children}</div>;
}
