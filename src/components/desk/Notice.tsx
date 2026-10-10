import Link from "next/link";
import s from "./notice.module.css";

/**
 * A whole-frame message for when there is no desk to show: the 404 and the
 * error boundary. The wordmark leads home; the big line says what happened.
 */
export function Notice({ code, title, children, actions }: { code: string; title: string; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className={s.notice}>
      <Link href="/" className={s.mark} aria-label="Court Vision home">
        <span aria-hidden>
          COURT<span className={s.accent}>VISION</span>
        </span>
      </Link>
      <main className={s.body}>
        <span className={s.code}>{code}</span>
        <h1 className={s.title}>{title}</h1>
        <div className={s.text}>{children}</div>
        <div className={s.actions}>{actions}</div>
      </main>
    </div>
  );
}

export const noticeButton = (primary = false) => `${s.button} ${primary ? s.primary : ""}`;
