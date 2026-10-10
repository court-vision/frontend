import { DeskFrame } from "@/components/desk/DeskFrame";
import { deskMono, deskSans } from "@/components/desk/fonts";

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return <DeskFrame className={`${deskSans.variable} ${deskMono.variable}`}>{children}</DeskFrame>;
}
