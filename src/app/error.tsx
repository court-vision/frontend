"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureError } from "@/lib/report-error";
import { Notice, noticeButton } from "@/components/desk/Notice";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    captureError(error);
  }, [error]);

  return (
    <Notice
      code={error.digest ? `Error · ref ${error.digest}` : "Error"}
      title="This page hit an error."
      actions={
        <>
          <button type="button" className={noticeButton(true)} onClick={reset}>
            Try again
          </button>
          <Link href="/" className={noticeButton()}>
            Go home
          </Link>
        </>
      }
    >
      The rest of Court Vision is still running. Try again, or start over from home.
    </Notice>
  );
}
