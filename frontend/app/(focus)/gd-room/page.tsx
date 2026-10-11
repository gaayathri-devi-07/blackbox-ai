"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, CameraOff, Hand, Lock, RefreshCw, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Skeleton, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { GD_AGENTS, GD_AGENT_IDS, GD_MODERATOR } from "@/lib/gd/agents";
import { DISCUSSION_TIMING } from "@/lib/gd/conductor";
import { DiscussionRoom } from "./room";

const RULES = [
  { icon: Users, title: "The moderator opens the floor", body: "After each question the floor is open. Anyone may request it." },
  { icon: Lock, title: "One speaker holds the floor", body: "While someone speaks the floor is locked. Everyone else waits — no interruptions." },
  { icon: Hand, title: "Requests are served in order", body: "When the speaker finishes, queued participants get the floor one at a time." },
];

export default function GDRoomPage() {
  const toast = useToast();
  const [topic, setTopic] = useState<string | null>(null);
  const [loadingTopic, setLoadingTopic] = useState(true);
  const [session, setSession] = useState(0);
  const [inRoom, setInRoom] = useState(false);
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const preview = useRef<HTMLVideoElement>(null);

  const newTopic = useCallback(async () => {
    setLoadingTopic(true);
    try {
      const res = await api<{ topic: string }>("/api/gd", { method: "POST", body: { action: "topic" } });
      setTopic(res.topic);
    } catch (error) {
      toast.error("Couldn't fetch a topic", errorMessage(error));
      setTopic((t) => t ?? "Should AI-generated code require mandatory human review before it reaches production?");
    } finally {
      setLoadingTopic(false);
    }
  }, [toast]);

  useEffect(() => {
    void newTopic();
  }, [newTopic]);

  useEffect(() => {
    if (preview.current && camera) {
      preview.current.srcObject = camera;
      void preview.current.play().catch(() => undefined);
    }
  }, [camera, inRoom]);

  useEffect(() => () => camera?.getTracks().forEach((t) => t.stop()), [camera]);

  async function toggleCamera() {
    if (camera) {
      camera.getTracks().forEach((t) => t.stop());
      setCamera(null);
      return;
    }
    try {
      setCamera(await navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
    } catch {
      toast.error("Camera unavailable", "You can take part without video.");
    }
  }

  if (inRoom && topic) {
    return (
      <DiscussionRoom
        key={session}
        topic={topic}
        cameraStream={camera}
        onExit={() => {
          setInRoom(false);
          void newTopic();
        }}
      />
    );
  }

  return (
    <div className="room-backdrop min-h-dvh">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <Brand />
        <Button variant="ghost" size="sm" asChild>
          <Link href="/home">Exit to dashboard</Link>
        </Button>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="eyebrow">Group discussion</p>
          <h1 className="mt-2 text-[28px] font-semibold leading-9 tracking-tight">
            A moderated panel with <span className="font-display text-[1.15em] font-normal italic">strict floor control.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            You join four AI candidates and a moderator for {DISCUSSION_TIMING.maxTurns} turns. Assessors score how clearly you argue, how well you build on others, and
            whether you claim the floor with confidence.
          </p>

          <section className="mt-8 rounded-lg border bg-card p-5" aria-labelledby="topic-heading">
            <div className="flex items-center justify-between gap-3">
              <p id="topic-heading" className="eyebrow">Today&apos;s topic</p>
              <Button variant="ghost" size="sm" onClick={() => void newTopic()} disabled={loadingTopic}>
                <RefreshCw className={loadingTopic ? "animate-spin" : undefined} /> Another topic
              </Button>
            </div>
            {loadingTopic && !topic ? <Skeleton className="mt-3 h-7 w-4/5" /> : <p className="mt-2 text-lg font-medium leading-7">{topic}</p>}
          </section>

          <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Floor rules">
            {RULES.map((r) => (
              <div key={r.title} className="rounded-lg border p-4">
                <r.icon className="size-4 text-accent" />
                <p className="mt-3 text-[13px] font-medium">{r.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </section>

          <section className="mt-6" aria-labelledby="panel-heading">
            <p id="panel-heading" className="eyebrow mb-3">The panel</p>
            <ul className="divide-y rounded-lg border">
              <li className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-8 items-center justify-center rounded-md border bg-muted font-mono text-[11px]">RM</span>
                <span className="flex-1 text-[13px]"><span className="font-medium">{GD_MODERATOR.name}</span> <span className="text-muted-foreground">· {GD_MODERATOR.title}</span></span>
              </li>
              {GD_AGENT_IDS.map((id) => (
                <li key={id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-8 items-center justify-center rounded-md border bg-muted font-mono text-[11px]">{GD_AGENTS[id].initials}</span>
                  <span className="flex-1 text-[13px]">
                    <span className="font-medium">{GD_AGENTS[id].name}</span>{" "}
                    <span className="text-muted-foreground">· {GD_AGENTS[id].label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="aspect-video bg-black">
              {camera ? (
                <video ref={preview} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[13px] text-white/60">Camera off</div>
              )}
            </div>
            <div className="space-y-3 p-4">
              <Button variant="outline" className="w-full" onClick={toggleCamera}>
                {camera ? <CameraOff /> : <Camera />} {camera ? "Turn camera off" : "Turn camera on (optional)"}
              </Button>
              <p className="text-[12px] leading-5 text-muted-foreground">
                When you hold the floor, speak naturally — your words are transcribed in the browser. You can also type.
              </p>
              <Button
                className="w-full"
                disabled={!topic || loadingTopic}
                onClick={() => {
                  setSession((s) => s + 1);
                  setInRoom(true);
                }}
              >
                {loadingTopic ? <Spinner className="text-primary-foreground" /> : null}
                Join the discussion <ArrowRight />
              </Button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
