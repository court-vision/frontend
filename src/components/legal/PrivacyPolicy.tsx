import Link from "next/link";
import s from "./legal.module.css";

/** Where privacy questions and deletion requests go. */
export const PRIVACY_CONTACT = "mail@courtvision.dev";
export const PRIVACY_UPDATED = "October 10, 2026";

/**
 * Court Vision's privacy policy, covering the web app and the Draft Tap
 * extension. Plain statements of what is collected and why; keep it in step
 * with the code (and with the Chrome Web Store privacy answers in the
 * draft-extension repo's store/PUBLISHING.md).
 */
export function PrivacyPolicy() {
  return (
    <div className={s.page}>
      <header className={s.top}>
        <Link href="/" className={s.mark} aria-label="Court Vision home">
          <span aria-hidden>
            COURT<span className={s.accent}>VISION</span>
          </span>
        </Link>
      </header>
      <main className={s.doc}>
        <h1 className={s.title}>Privacy</h1>
        <p className={s.updated}>Updated {PRIVACY_UPDATED}</p>
        <p className={s.lede}>
          Court Vision is a fantasy basketball app for ESPN leagues. This page says what we collect, why, who else
          handles it, and how to have it deleted. It covers courtvision.dev and the Court Vision Draft Tap extension for
          Chrome. We don&apos;t sell your data or use it for advertising.
        </p>

        <section>
          <h2>Your account</h2>
          <p>
            Sign-in is handled by <a href="https://clerk.com/legal/privacy" target="_blank" rel="noreferrer">Clerk</a>.
            When you create an account, Clerk keeps your email address and, if you sign in with Google, your name and
            profile picture. Court Vision keeps your email address and Clerk&apos;s id for you, to tie your teams and
            settings to your account.
          </p>
        </section>

        <section>
          <h2>Your leagues and teams</h2>
          <ul>
            <li>
              <b>Teams you add:</b> the league and team ids, team and league names, and the league&apos;s settings
              (scoring, roster spots, schedule), so every desk can work from your league&apos;s own rules.
            </li>
            <li>
              <b>ESPN connection:</b> to read a private league and make the lineup changes and pickups you ask for,
              Court Vision needs the two ESPN sign-in cookies you paste in (<code>espn_s2</code> and{" "}
              <code>SWID</code>). They are stored encrypted, used only to talk to ESPN on your behalf, and deleted when
              you remove the connection on the Account desk.
            </li>
            <li>
              <b>Yahoo connection:</b> if you connect a Yahoo account, the access tokens Yahoo issues, stored encrypted
              and used only to read your Yahoo leagues.
            </li>
            <li>
              <b>What you do:</b> the lineup moves, pickups and scheduled pickups you send, and a daily copy of your
              lineup, so the Week desk can show what was set and what it scored.
            </li>
            <li>
              <b>Lineup alerts:</b> your alert preferences, and a record of the emails we send you (through{" "}
              <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">Resend</a>).
            </li>
            <li>
              <b>Draft rooms:</b> the draft rooms you create and their picks.
            </li>
            <li>
              <b>Developer keys:</b> API keys you create, stored hashed.
            </li>
          </ul>
        </section>

        <section id="draft-tap">
          <h2>The Draft Tap extension</h2>
          <p>
            The Draft Tap connects your ESPN draft room to the Court Vision draft room you have open, so ESPN&apos;s picks
            appear in Court Vision as they happen. It does nothing until you turn on sharing, which it asks for when you
            install it.
          </p>
          <ul>
            <li>
              <b>What it reads:</b> the messages your ESPN fantasy draft room sends and receives (picks, the draft
              order, the clock, team and league names, and the ESPN member ids in them), only on fantasy.espn.com draft
              pages.
            </li>
            <li>
              <b>Where it goes:</b> only to Court Vision draft rooms you open in the same browser. The room saves the
              draft&apos;s starting state and each pick to your Court Vision account, so the room survives a reload.
            </li>
            <li>
              <b>What it keeps:</b> a log of the draft room&apos;s messages in your browser (up to 20,000), so a room
              opened late can catch up. Clear it from the extension&apos;s popup at any time; turning sharing off clears
              it too.
            </li>
            <li>
              <b>Sending picks:</b> only if you also switch on &ldquo;Allow drafting from Court Vision&rdquo; in its
              popup. It never opens a connection of its own to ESPN.
            </li>
          </ul>
        </section>

        <section>
          <h2>Service providers</h2>
          <p>Court Vision runs on a few services that process data on our behalf:</p>
          <ul>
            <li>
              <b>Clerk</b> for sign-in; <b>Vercel</b> hosts the website and measures page views and load speed
              (Vercel Analytics and Speed Insights, which don&apos;t use cookies); <b>Railway</b> hosts our servers and
              database.
            </li>
            <li>
              <b>Sentry</b> receives error reports when something breaks, configured not to send personal
              information; <b>Resend</b> delivers our emails.
            </li>
            <li>
              <b>ESPN</b> and <b>Yahoo</b>, only for the leagues you connect, and only to do what you ask.
            </li>
          </ul>
          <p>We don&apos;t share your data with anyone else, except where the law requires it.</p>
        </section>

        <section>
          <h2>Cookies and storage</h2>
          <p>
            Clerk sets the cookies that keep you signed in. Court Vision itself keeps a few settings in your browser,
            such as your theme. There are no advertising or tracking cookies.
          </p>
        </section>

        <section id="contact">
          <h2>Deleting your data, and questions</h2>
          <p>
            Remove a team, or an ESPN or Yahoo connection, on the Account desk at any time; removing a connection
            deletes the credentials stored for it. To delete your account and everything tied to it, or to ask anything about this policy, email{" "}
            <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>. We&apos;ll confirm when it&apos;s done.
          </p>
          <p>If this policy changes, the date at the top changes with it.</p>
        </section>
      </main>
    </div>
  );
}
