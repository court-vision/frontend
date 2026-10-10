import Link from "next/link";
import { Notice, noticeButton } from "@/components/desk/Notice";
import { SCOUT_DESK } from "@/components/desk/routes";

export default function NotFound() {
  return (
    <Notice
      code="404"
      title="No play here."
      actions={
        <>
          <Link href="/" className={noticeButton(true)}>
            Go home
          </Link>
          <Link href={SCOUT_DESK} className={noticeButton()}>
            Open Scout
          </Link>
        </>
      }
    >
      That page doesn&apos;t exist. If you followed an old link, Court Vision now runs on desks: Week, Draft, Scout,
      Developer and Account.
    </Notice>
  );
}
