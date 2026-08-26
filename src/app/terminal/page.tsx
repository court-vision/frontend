"use client";

import { DesktopOnlyNotice } from "@/components/DesktopOnlyNotice";
import { TerminalLayout } from "@/components/terminal";
import { useIsBelowLg } from "@/hooks/useBreakpoint";

export default function TerminalPage() {
  const belowLg = useIsBelowLg();

  // `/terminal` is a full-height page (unpadded main), so the notice pads itself.
  if (belowLg) return <DesktopOnlyNotice feature="Terminal" className="p-5" />;

  // `hidden lg:block` hides the SSR frame on small screens before hydration;
  // the hook then unmounts it in favour of the notice.
  return (
    <div className="hidden lg:block h-full">
      <TerminalLayout />
    </div>
  );
}
