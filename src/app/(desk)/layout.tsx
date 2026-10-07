import { Geist, Geist_Mono } from "next/font/google";
import { DeskFrame } from "@/components/desk/DeskFrame";

// The desks' own type: Geist for text, Geist Mono for every number.
const sans = Geist({ subsets: ["latin"], variable: "--desk-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--desk-mono", display: "swap" });

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return <DeskFrame className={`${sans.variable} ${mono.variable}`}>{children}</DeskFrame>;
}
