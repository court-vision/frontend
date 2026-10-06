"use client";

import { useState } from "react";
import Link from "next/link";
import { DeskBar } from "@/components/desk/DeskBar";
import dk from "@/components/desk/desk.module.css";
import { demoIdFromSlug } from "@/lib/draft-demo";
import { Lobby } from "./Lobby";
import { RecapView } from "./Recap";
import { RoomView } from "./RoomView";
import { useDemoLobby, useDemoRecap, useDemoRoom, useLiveLobby, useLiveRecap, useLiveRoom } from "./useRoomModels";

/** A room is a session id, or `demo-N` for a room that lives in the browser. */
function parseSlug(slug: string): { demo: number } | { live: number } | null {
  const demo = demoIdFromSlug(slug);
  if (demo != null) return { demo };
  const id = Number(slug);
  return Number.isInteger(id) && id > 0 ? { live: id } : null;
}

function NoSuchRoom() {
  return (
    <>
      <DeskBar desk="draft" />
      <div className={dk.empty}>
        <span className={dk.emptyTitle}>No such draft room</span>
        <Link href="/draft" className={dk.btn}>
          All rooms
        </Link>
      </div>
    </>
  );
}

export function DraftRoomPage({ slug }: { slug: string }) {
  const parsed = parseSlug(slug);
  if (!parsed) return <NoSuchRoom />;
  return "demo" in parsed ? <DemoRoom id={parsed.demo} /> : <LiveRoom id={parsed.live} />;
}

function LiveRoom({ id }: { id: number }) {
  return <RoomView model={useLiveRoom(id)} />;
}

function DemoRoom({ id }: { id: number }) {
  return <RoomView model={useDemoRoom(id)} />;
}

export function DraftRecapPage({ slug }: { slug: string }) {
  const parsed = parseSlug(slug);
  if (!parsed) return <NoSuchRoom />;
  return "demo" in parsed ? <DemoRecap id={parsed.demo} /> : <LiveRecap id={parsed.live} />;
}

function LiveRecap({ id }: { id: number }) {
  return <RecapView model={useLiveRecap(id)} />;
}

function DemoRecap({ id }: { id: number }) {
  return <RecapView model={useDemoRecap(id)} />;
}

export function DraftLobbyPage({ demo }: { demo: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  return demo ? <DemoLobby selected={selected} select={setSelected} /> : <LiveLobby selected={selected} select={setSelected} />;
}

function LiveLobby({ selected, select }: { selected: number | null; select: (id: number | null) => void }) {
  return <Lobby model={useLiveLobby(selected, select)} />;
}

function DemoLobby({ selected, select }: { selected: number | null; select: (id: number | null) => void }) {
  return <Lobby model={useDemoLobby(selected, select)} />;
}
