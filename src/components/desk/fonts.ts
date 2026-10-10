import { Geist, Geist_Mono } from "next/font/google";

// The desks' own type: Geist for text, Geist Mono for every number. Shared by
// the (desk) layout and the landing page, which renders a desk frame of its own.
export const deskSans = Geist({ subsets: ["latin"], variable: "--desk-sans", display: "swap" });
export const deskMono = Geist_Mono({ subsets: ["latin"], variable: "--desk-mono", display: "swap" });
