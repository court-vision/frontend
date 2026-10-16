import { Barlow_Semi_Condensed, Geist, Geist_Mono, Space_Grotesk } from "next/font/google";

// The desks' own type: Geist for text, Geist Mono for every number. Shared by
// the (desk) layout and the landing page, which renders a desk frame of its own.
export const deskSans = Geist({ subsets: ["latin"], variable: "--desk-sans", display: "swap" });
export const deskMono = Geist_Mono({ subsets: ["latin"], variable: "--desk-mono", display: "swap" });

// Faces a theme can set as its --desk-sans (desk.module.css): Space Grotesk for
// Chalk, Barlow Semi Condensed for Blacktop. Neither is preloaded, so a browser
// fetches only the one its theme draws with.
export const faceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--face-grotesk", display: "swap", preload: false });
export const faceCondensed = Barlow_Semi_Condensed({
  subsets: ["latin"],
  variable: "--face-condensed",
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

/** Every desk face's variable, for the element the frame sits in. */
export const deskFontVariables = [deskSans, deskMono, faceGrotesk, faceCondensed].map((f) => f.variable).join(" ");
