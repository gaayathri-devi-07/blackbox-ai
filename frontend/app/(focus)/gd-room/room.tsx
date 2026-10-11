"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Hand, Lock, Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { DiscussionConductor, DISCUSSION_TIMING, type AgentActivity, type TranscriptEntry } from "@/lib/gd/conductor";
import { GD_AGENTS, GD_AGENT_IDS, GD_MODERATOR, type GDAgentId } from "@/lib/gd/agents";
import { cancelSpeech, createRecognizer, loadVoices, pickVoice, speak, speechRecognitionSupported, type Recognizer } from "@/lib/speech";
import { cn } from "@/lib/utils";

const VOICE_GENDER: Record<string, "male" | "female"> = { moderator: "male", ai1: "male", ai2: "female", ai3: "male", ai4: "male" };
const SPEAKER_ORDER = ["moderator", "ai1", "ai2", "ai3", "ai4"] as const;
/** Slight per-speaker pitch and pace so voices stay distinguishable even when a browser has few voices. */
const DELIVERY: Record<string, { pitch: number; rate: number }> = {
  moderator: { pitch: 0.95, rate: 0.96 },
  ai1: { pitch: 1, rate: 0.98 },
  ai2: { pitch: 1.05, rate: 1 },
  ai3: { pitch: 0.9, rate: 1.03 },
  ai4: { pitch: 1.08, rate: 0.97 },
};

function aiVoiceFor(speakerId: string): { serverVoice: string; style: string } {
  const agent = GD_AGENTS[speakerId as GDAgentId];
  return agent
    ? { serverVoice: agent.aiVoice, style: agent.speakingStyle }
    : { serverVoice: GD_MODERATOR.aiVoice, style: GD_MODERATOR.speakingStyle };
}
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function toHistory(entries: TranscriptEntry[]) {
  return entries.slice(-12).map((e) => ({ speakerId: e.speakerId, speakerName: e.speakerName, text: e.text.slice(0, 3000), at: e.at }));
}

// ─── Tiles ────────────────────────────────────────────────────────────────────

function StatusChip({ activity, position, drafting }: { activity: AgentActivity | "listening"; position?: number; drafting?: boolean }) {
  if (drafting && (activity === "waiting" || activity === "idle")) {
    return (
      <Badge variant="accent">
        <Spinner className="size-3 text-accent" /> Drafting a reply
      </Badge>
    );
  }
  switch (activity) {
    case "speaking":
      return <Badge variant="accent">Speaking</Badge>;
    case "preparing":
      return <Badge variant="accent"><Spinner className="size-3 text-accent" /> Has the floor</Badge>;
    case "queued":
      return <Badge variant="warning">Queued{position ? ` · ${position}` : ""}</Badge>;
    case "waiting":
      return <Badge variant="outline">Waiting</Badge>;
    default:
      return <Badge variant="outline">Listening</Badge>;
  }
}

function VideoTile({
  src,
  active,
  name,
  subtitle,
  chip,
  line,
  loopWhenIdle = false,
}: {
  src: string;
  active: boolean;
  name: string;
  subtitle: string;
  chip: React.ReactNode;
  line?: string | null;
  loopWhenIdle?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Only the floor holder's video moves; everyone else freezes.
    if (active || loopWhenIdle) void v.play().catch(() => undefined);
    else v.pause();
  }, [active, loopWhenIdle, src]);

  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-xl border bg-black shadow-panel transition-shadow", active && "ring-2 ring-accent/70 ring-offset-2 ring-offset-background")}>
      <video ref={ref} src={src} muted loop playsInline preload="auto" className={cn("h-full w-full object-cover transition-opacity", !active && "opacity-70")} />
      <div className="absolute right-2 top-2">{chip}</div>
      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-white">
        <p className="text-[13px] font-medium leading-4">{name}</p>
        <p className="text-[11px] text-white/65">{subtitle}</p>
        {line && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/85">{line}</p>}
      </div>
    </div>
  );
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export function DiscussionRoom({ topic, cameraStream, onExit }: { topic: string; cameraStream: MediaStream | null; onExit: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  // One distinct voice per speaker, best-sounding first.
  const voiceMapRef = useRef<Record<string, SpeechSynthesisVoice | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadVoices().then((voices) => {
      const used: string[] = [];
      for (const id of SPEAKER_ORDER) {
        const voice = pickVoice(voices, null, VOICE_GENDER[id], { exclude: used });
        if (voice) used.push(voice.name);
        voiceMapRef.current[id] = voice;
      }
    });
  }, []);

  const complete = useCallback(
    async (transcript: TranscriptEntry[], durationSec: number) => {
      setSaving(true);
      try {
        const res = await api<{ id: string }>("/api/gd", {
          method: "POST",
          timeoutMs: 60_000,
          body: {
            action: "complete",
            topic,
            transcript: transcript.slice(-200).map((e) => ({ ...e, text: e.text.slice(0, 3000) })),
            durationSec,
          },
        });
        router.replace(`/gd-room/results?id=${res.id}`);
      } catch (error) {
        setSaving(false);
        toast.error("Couldn't save the discussion", errorMessage(error));
      }
    },
    [router, toast, topic]
  );

  // The latest completion handler, readable from the long-lived conductor.
  const completeRef = useRef(complete);
  useEffect(() => {
    completeRef.current = complete;
  }, [complete]);

  // The conductor owns timers, network calls and audio, so it is created and
  // destroyed with the mount (Strict Mode remounts get a fresh instance).
  const [conductor, setConductor] = useState<DiscussionConductor | null>(null);
  useEffect(() => {
    const instance = new DiscussionConductor(topic, {
      agentTurn: async (agentId, history, signal) =>
        // Server runs the LangGraph turn: listen → gather → draft → review.
        api<{ text: string; move?: string; respondingTo?: string | null }>("/api/gd", {
          method: "POST",
          signal,
          timeoutMs: 25_000,
          body: { action: "turn", topic, agentId, history: toHistory(history) },
        }),
      followUp: async (history, signal) => {
        const res = await api<{ text: string }>("/api/gd", {
          method: "POST",
          signal,
          timeoutMs: 15_000,
          body: { action: "follow_up", topic, history: toHistory(history) },
        });
        return res.text;
      },
      speak: (text, speakerId, signal) =>
        speak(text, {
          voice: voiceMapRef.current[speakerId] ?? null,
          ...(DELIVERY[speakerId] ?? DELIVERY.ai1),
          ...aiVoiceFor(speakerId),
          hint: { role: speakerId === "moderator" ? "moderator" : "panelist", persona: { name: GD_AGENTS[speakerId as GDAgentId]?.name } },
          signal,
          muted: mutedRef.current,
        }),
      onComplete: (t, d) => void completeRef.current(t, d),
    });
    setConductor(instance);
    void instance.start();
    return () => {
      instance.dispose();
      cancelSpeech();
    };
  }, [topic]);

  if (!conductor) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <RoomView
      conductor={conductor}
      topic={topic}
      cameraStream={cameraStream}
      onExit={onExit}
      muted={muted}
      setMuted={setMuted}
      saving={saving}
    />
  );
}

function RoomView({
  conductor,
  topic,
  cameraStream,
  onExit,
  muted,
  setMuted,
  saving,
}: {
  conductor: DiscussionConductor;
  topic: string;
  cameraStream: MediaStream | null;
  onExit: () => void;
  muted: boolean;
  setMuted: React.Dispatch<React.SetStateAction<boolean>>;
  saving: boolean;
}) {
  const toast = useToast();
  const state = useSyncExternalStore(conductor.subscribe, conductor.getState, conductor.getState);
  const { floor } = state;
  const userHolds = floor.holder === "user";
  const userQueuePos = floor.queue.indexOf("user") + 1;


  // Elapsed time.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!state.startedAt || state.phase === "ended") return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - (state.startedAt ?? Date.now())) / 1000)), 1000);
    return () => clearInterval(t);
  }, [state.startedAt, state.phase]);

  // ── The user's turn: dictation + typed fallback ────────────────────────────
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [dictation, setDictation] = useState(speechRecognitionSupported());
  const recognizerRef = useRef<Recognizer | null>(null);
  const draftRef = useRef("");
  useEffect(() => {
    draftRef.current = `${draft} ${interim}`.trim();
  }, [draft, interim]);

  const stopDictation = useCallback(() => {
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setInterim("");
    setListening(false);
  }, []);

  useEffect(() => {
    if (!userHolds) return;
    setDraft("");
    setInterim("");
    if (dictation) {
      recognizerRef.current = createRecognizer({
        onText: (finalText, interimText) => {
          setDraft(finalText);
          setInterim(interimText);
        },
        onStateChange: setListening,
        onError: (m) => {
          setDictation(false);
          toast.error("Dictation unavailable", m);
        },
      });
      recognizerRef.current?.start();
    }
    // Flush the draft just before the conductor's hard time limit.
    const limit = setTimeout(() => {
      stopDictation();
      conductor.finishUserTurn(draftRef.current);
      toast.notify({ tone: "info", title: "Time's up", description: "Your turn ended at the two-minute limit." });
    }, DISCUSSION_TIMING.userTurnMaxMs - 3_000);
    return () => {
      clearTimeout(limit);
      stopDictation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userHolds]);

  function endTurn(text = draftRef.current) {
    stopDictation();
    conductor.finishUserTurn(text);
  }

  const turnElapsed = state.user.turnStartedAt ? Math.round((Date.now() - state.user.turnStartedAt) / 1000) : 0;
  void elapsed; // re-render each second keeps the turn timer fresh

  const holderName = useMemo(() => {
    if (!floor.holder) return null;
    if (floor.holder === "user") return "You";
    if (floor.holder === "moderator") return GD_MODERATOR.name;
    return GD_AGENTS[floor.holder as GDAgentId]?.name ?? floor.holder;
  }, [floor.holder]);

  const floorPill =
    floor.state === "OPEN"
      ? { label: "Floor open", tone: "success" as const, detail: floor.queue.length ? "Granting in queue order" : "Request the floor to speak" }
      : floor.state === "LOCKED"
        ? {
            label: "Floor locked",
            tone: "warning" as const,
            detail: floor.holder === "user" ? "You have the floor — everyone else is waiting" : `${holderName} has the floor — everyone else is waiting`,
          }
        : floor.state === "MODERATOR"
          ? { label: "Moderator", tone: "accent" as const, detail: state.moderator.preparing ? "Preparing a question" : "The moderator has the floor" }
          : { label: floor.state === "CLOSED" ? "Closed" : "Starting", tone: "outline" as const, detail: state.notice };

  const transcriptEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, which React would treat as a cleanup.
    void transcriptEnd.current?.scrollIntoView({ block: "end" });
  }, [state.transcript.length]);

  const userVideo = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (userVideo.current && cameraStream) {
      userVideo.current.srcObject = cameraStream;
      void userVideo.current.play().catch(() => undefined);
    }
  }, [cameraStream]);

  const participantTurns = floor.turns;

  return (
    <div className="room-backdrop flex min-h-dvh flex-col">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="eyebrow">Group discussion</p>
          <p className="mt-0.5 line-clamp-1 text-[14px] font-medium">{topic}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] text-muted-foreground tabular">
            Turn {Math.min(participantTurns, DISCUSSION_TIMING.maxTurns)}/{DISCUSSION_TIMING.maxTurns} · {fmt(elapsed)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              setMuted((m) => !m);
              if (!muted) cancelSpeech();
            }}
            aria-label={muted ? "Unmute voices" : "Mute voices"}
            title={muted ? "Unmute voices" : "Mute voices"}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={state.phase === "wrapping" || state.phase === "ended"}
            onClick={() => {
              if (userHolds) endTurn();
              conductor.stop();
            }}
          >
            <PhoneOff /> End discussion
          </Button>
        </div>
      </header>

      {/* Floor status */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-2.5 sm:px-6" aria-live="polite">
        <Badge variant={floorPill.tone}>
          {floor.state === "LOCKED" && <Lock />}
          {floorPill.label}
        </Badge>
        <span className="text-[13px] text-muted-foreground">{floorPill.detail}</span>
        {floor.queue.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground">
            Queue
            {floor.queue.map((id, i) => (
              <Badge key={id} variant={id === "user" ? "accent" : "outline"}>
                {i + 1}. {id === "user" ? "You" : GD_AGENTS[id as GDAgentId].name.split(" ")[0]}
              </Badge>
            ))}
          </span>
        )}
      </div>

      <main className="grid flex-1 gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {/* Moderator */}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <VideoTile
              src={state.moderator.speaking ? "/mentalk.mp4" : "/menblink.mp4"}
              active={state.moderator.speaking}
              loopWhenIdle
              name={GD_MODERATOR.name}
              subtitle={GD_MODERATOR.title}
              chip={
                state.moderator.speaking ? <Badge variant="accent">Speaking</Badge> : state.moderator.preparing ? <Badge variant="accent">Preparing</Badge> : <Badge variant="outline">Chair</Badge>
              }
            />
            <div className="flex flex-col justify-center rounded-lg border bg-card p-5">
              <p className="eyebrow">Moderator</p>
              <p className="mt-2 text-[15px] leading-7">
                {state.moderator.preparing ? <span className="text-muted-foreground">Preparing a follow-up question…</span> : state.moderator.line ?? "The discussion will begin shortly."}
              </p>
            </div>
          </div>

          {/* Candidates */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {GD_AGENT_IDS.map((id) => {
              const agent = GD_AGENTS[id];
              const a = state.agents[id];
              return (
                <VideoTile
                  key={id}
                  src={agent.video}
                  active={a.activity === "speaking"}
                  name={agent.name}
                  subtitle={a.activity === "speaking" && a.intent ? `${agent.label} · ${a.intent}` : `${agent.label} · ${a.turns} turn${a.turns === 1 ? "" : "s"}`}
                  chip={<StatusChip activity={a.activity} drafting={a.drafting} position={floor.queue.indexOf(id) + 1 || undefined} />}
                  line={a.activity === "speaking" ? a.line : null}
                />
              );
            })}
          </div>

          {/* The user */}
          <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
            <div className={cn("relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted", userHolds && "border-accent ring-1 ring-accent")}>
              {cameraStream ? (
                <video ref={userVideo} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-sm text-muted-foreground">YOU</div>
              )}
              <div className="absolute right-2 top-2">
                {userHolds ? (
                  <Badge variant="accent">Speaking</Badge>
                ) : userQueuePos ? (
                  <Badge variant="warning">Queued · {userQueuePos}</Badge>
                ) : floor.state === "LOCKED" || floor.state === "MODERATOR" ? (
                  <Badge variant="outline">Waiting</Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col rounded-lg border bg-card p-4">
              {userHolds ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium">You have the floor</p>
                    <span className="flex items-center gap-3 text-[12px] text-muted-foreground">
                      {listening && (
                        <span className="inline-flex items-center gap-1.5 text-danger">
                          <span className="size-1.5 animate-pulse rounded-full bg-danger" /> Listening
                        </span>
                      )}
                      <span className="font-mono tabular">{fmt(Math.max(0, DISCUSSION_TIMING.userTurnMaxMs / 1000 - turnElapsed))} left</span>
                    </span>
                  </div>
                  <Textarea
                    value={interim ? `${draft} ${interim}`.trim() : draft}
                    onChange={(e) => {
                      if (listening) stopDictation();
                      setInterim("");
                      setDraft(e.target.value);
                    }}
                    placeholder={dictation ? "Speak now — your words appear here. You can also type." : "Type your contribution."}
                    className="mt-2 min-h-28 flex-1 resize-none"
                    autoFocus
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {speechRecognitionSupported() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (listening) {
                            stopDictation();
                            setDictation(false);
                          } else {
                            setDictation(true);
                            const base = draft;
                            recognizerRef.current = createRecognizer({
                              onText: (f, i) => {
                                setDraft(`${base} ${f}`.trim());
                                setInterim(i);
                              },
                              onStateChange: setListening,
                            });
                            recognizerRef.current?.start();
                          }
                        }}
                      >
                        {listening ? <Mic /> : <MicOff />} {listening ? "Pause dictation" : "Resume dictation"}
                      </Button>
                    )}
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => endTurn("")}>
                        Pass
                      </Button>
                      <Button size="sm" onClick={() => endTurn()} disabled={!`${draft} ${interim}`.trim()}>
                        Finish and release floor
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium">
                      {userQueuePos
                        ? `You're number ${userQueuePos} in the queue`
                        : floor.state === "OPEN"
                          ? "The floor is open"
                          : floor.state === "LOCKED"
                            ? `Waiting — ${holderName} has the floor`
                            : floor.state === "MODERATOR"
                              ? "Waiting — the moderator has the floor"
                              : state.notice}
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                      {userQueuePos
                        ? "You'll be handed the floor automatically when it's your turn."
                        : floor.state === "OPEN"
                          ? "Request the floor to make your point. Requests are granted in the order received."
                          : "Interruptions are disabled. You can request the floor as soon as it reopens."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {userQueuePos ? (
                      <Button variant="outline" onClick={() => conductor.withdraw()}>
                        Withdraw request
                      </Button>
                    ) : (
                      <Button onClick={() => conductor.requestFloor()} disabled={floor.state !== "OPEN" || state.phase !== "live"}>
                        {floor.state === "OPEN" ? <Hand /> : <Lock />}
                        {floor.state === "OPEN" ? "Request the floor" : "Floor locked"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transcript */}
        <aside className="flex min-h-[320px] flex-col rounded-lg border bg-card xl:max-h-[calc(100dvh-140px)]">
          <p className="border-b px-4 py-3 text-[13px] font-medium">Transcript</p>
          <ol className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
            {state.transcript.length === 0 && <li className="text-[13px] text-muted-foreground">The transcript will appear here.</li>}
            {state.transcript.map((t, i) => (
              <li key={i} className={cn("animate-blur-in text-[13px] leading-5", t.speakerId === "user" && "rounded-md border-l-2 border-accent bg-accent-soft/50 px-3 py-2")}>
                <p className={cn("text-[12px] font-medium", t.speakerId === "moderator" ? "text-muted-foreground" : "text-foreground")}>{t.speakerName}</p>
                <p className={cn("mt-0.5", t.speakerId === "moderator" ? "italic text-muted-foreground" : "")}>{t.text}</p>
              </li>
            ))}
            <div ref={transcriptEnd} />
          </ol>
        </aside>
      </main>

      {(saving || state.phase === "ended") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm" role="status">
          <div className="text-center">
            {saving ? <Spinner className="mx-auto size-5" /> : null}
            <p className="mt-3 text-sm font-medium">{saving ? "Assessing your contributions" : "Discussion complete"}</p>
            {!saving && (
              <Button className="mt-4" size="sm" variant="outline" onClick={onExit}>
                Back to lobby
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
