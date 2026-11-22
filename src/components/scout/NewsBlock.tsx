"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { usePlayerNewsQuery } from "@/hooks/usePlayerNews";
import { useViewerZone } from "@/hooks/useViewerZone";
import { userMessage } from "@/lib/api-error";
import { localDateTime } from "@/lib/local-time";
import { LONG_BODY, NEWS_DAYS, NEWS_SHOWN, kindLabel, newsAge, newsStories, type NewsStory } from "@/lib/player-news";
import type { Focus } from "@/lib/scout";
import { Block, Skeleton } from "./blocks";
import s from "./scout.module.css";
import n from "./news.module.css";

/**
 * The player sheet's News block: what ESPN, Rotowire and RealGM said about
 * him over the last two weeks, as the news pipeline stored it. A story two
 * sources carried shows once, with both names. Loads once the sheet rests,
 * like the profile.
 */
export function NewsBlock({ playerId, name, settled, open }: { playerId: number; name: string | null; settled: boolean; open: (focus: Focus) => void }) {
  const news = usePlayerNewsQuery(playerId, settled);
  const stories = useMemo(() => newsStories(news.data?.items ?? [], playerId), [news.data, playerId]);
  const [all, setAll] = useState(false);
  const tz = useViewerZone();
  const now = useMinute();

  const shown = all ? stories : stories.slice(0, NEWS_SHOWN);
  const note = stories.length ? `${stories.length} ${stories.length === 1 ? "story" : "stories"} · last ${NEWS_DAYS} days` : `last ${NEWS_DAYS} days`;

  let body: React.ReactNode;
  if (news.data === undefined && (news.isLoading || !settled)) {
    body = <Skeleton rows={3} className={s.ledgerSkel} />;
  } else if (news.error && !news.data) {
    body = <div className={s.blockEmpty}>{userMessage(news.error, "Couldn't load his news")}</div>;
  } else if (!stories.length) {
    body = <div className={s.blockEmpty}>Nothing about {name ?? "this player"} in the last {NEWS_DAYS} days.</div>;
  } else {
    body = (
      <>
        <ol className={n.list}>
          {shown.map((story) => (
            <NewsRow key={story.key} story={story} now={now} tz={tz} open={open} />
          ))}
        </ol>
        {stories.length > NEWS_SHOWN ? (
          <button type="button" className={`${s.linkBtn} ${n.more}`} onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? "Show fewer" : `Show ${stories.length - NEWS_SHOWN} more`}
          </button>
        ) : null}
      </>
    );
  }

  return (
    <Block title="News" note={note}>
      {body}
    </Block>
  );
}

/** The time now, moved on each minute, so "38 min ago" keeps counting while the sheet stays open. */
function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function NewsRow({ story, now, tz, open }: { story: NewsStory; now: number; tz: string; open: (focus: Focus) => void }) {
  const [expanded, setExpanded] = useState(false);
  const age = newsAge(story.at, now, tz);
  const kind = kindLabel(story.kind);
  const long = (story.body?.length ?? 0) > LONG_BODY;

  return (
    <li className={n.row}>
      <div className={n.side}>
        <time
          className={n.age}
          data-fresh={age.fresh || undefined}
          dateTime={story.at != null ? new Date(story.at).toISOString() : undefined}
          title={story.at != null ? localDateTime(story.at, { tz, label: true }) : undefined}
        >
          {age.text}
        </time>
        {kind ? <span className={n.kind}>{kind}</span> : null}
        <span className={n.sources}>
          {story.sources.map((src) =>
            src.url ? (
              <a key={src.label} className={n.source} href={src.url} target="_blank" rel="noopener noreferrer" title={`Read it on ${src.label}`}>
                {src.label}
                <ArrowUpRight size={11} aria-hidden />
              </a>
            ) : (
              <span key={src.label} className={n.source}>
                {src.label}
              </span>
            )
          )}
        </span>
      </div>
      <div className={n.main}>
        <p className={n.headline}>{story.headline}</p>
        {story.body ? (
          long ? (
            <button type="button" className={n.body} data-open={expanded || undefined} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} title={expanded ? undefined : "Read it all"}>
              {story.body}
            </button>
          ) : (
            <p className={n.body}>{story.body}</p>
          )
        ) : null}
        {story.attribution || story.others.length ? (
          <div className={n.meta}>
            {story.attribution ? <span>via {story.attribution}</span> : null}
            {story.others.length ? (
              <span className={n.others}>
                also about
                {story.others.map((o) => (
                  <button key={o.id} type="button" className={s.linkBtn} onClick={() => open({ kind: "player", id: o.id })}>
                    {o.name}
                  </button>
                ))}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
