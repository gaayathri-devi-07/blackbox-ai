"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Camera, CameraOff, Check, Eye, Languages, Mic, MicOff, Pencil, PhoneOff, RotateCcw, Sparkles, Volume2, VolumeX } from "lucide-react";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar, Spinner, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useInterviewAnalyzer } from "@/hooks/useInterviewAnalyzer";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import {
  EXPERIENCE_LEVELS,
  INTERVIEW_MODES,
  MODE_LABELS,
  getCompany,
  type ExperienceLevel,
  type InterviewMode,
} from "@/lib/domain";
import {
  AnswerRecorder,
  SPEECH_LANGS,
  cancelSpeech,
  countFillers,
  createRecognizer,
  getSpeechLang,
  loadVoices,
  pickVoice,
  recognitionIsDelayed,
  serverVoicesAvailable,
  setSpeechLang,
  speak,
  speechRecognitionSupported,
  wavBase64,
  type Recognizer,
} from "@/lib/speech";
import {
  TRANSCRIPTION_OPTIONS,
  getTranscriptionQuality,
  localTranscriber,
  useLocalTranscriber,
  type TranscriptionQuality,
} from "@/lib/transcription";
import { cn } from "@/lib/utils";
import { readJobDescription } from "@/lib/job-description";
import { unlockAudio } from "@/lib/voice/stream-player";

type Phase = "preflight" | "starting" | "asking" | "answering" | "transcribing" | "reviewing" | "submitting" | "feedback" | "finishing";
type TurnKind = "question" | "followup" | "coaching";

interface AnswerFeedback {
  score: number;
  idealAnswer: string;
  corrections: string[];
  tip: string;
  keyPoints: string[];
  source: "model" | "heuristic";
}

interface TurnPayload {
  /** What the interviewer says aloud. */
  question: string;
  /** The bare question, shown on screen. */
  prompt: string;
  kind: TurnKind;
  keyPoints: string[];
  turnNumber: number;
  questionNumber: number;
  totalQuestions: number;
}

interface StartResponse extends TurnPayload {
  sessionId: string;
}

type RespondResponse =
  | ({ done: false; feedback: AnswerFeedback | null } & TurnPayload)
  | { done: true; question: null; turnNumber: number; questionNumber: number; totalQuestions: number; feedback: AnswerFeedback | null };

/** Gemini voices for the interviewer when AI voices are available. */
const AI_VOICE: Record<"male" | "female", string> = { male: "Charon", female: "Kore" };
const KIND_LABEL: Record<TurnKind, string> = { question: "Question", followup: "Follow-up", coaching: "Coaching" };

const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function InterviewerTile({ gender, speaking, thinking, name, title }: { gender: "male" | "female"; speaking: boolean; thinking: boolean; name: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const src = speaking ? (gender === "male" ? "/mentalk.mp4" : "/womentalk.mp4") : gender === "male" ? "/menblink.mp4" : "/womenblink.mp4";
    if (!video.src.endsWith(src)) {
      video.src = src;
      void video.play().catch(() => undefined);
    }
  }, [speaking, gender]);

  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-xl border bg-black shadow-panel transition-shadow", speaking && "ring-2 ring-accent/70 ring-offset-2 ring-offset-background")}>
      <video ref={videoRef} autoPlay loop muted playsInline className="h-full w-full object-cover" />
      {thinking && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="inline-flex items-center gap-2 rounded-md bg-black/60 px-3 py-1.5 text-xs text-white">
            <Spinner className="text-white" /> Preparing the next question
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-black/55 px-3 py-2 text-white">
        <div>
          <p className="text-[13px] font-medium leading-4">{name}</p>
          <p className="text-[11px] text-white/70">{title}</p>
        </div>
        {speaking && <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">Speaking</span>}
      </div>
    </div>
  );
}

function Room() {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();

  const company = getCompany(params.get("company"));
  const mode = (INTERVIEW_MODES.includes(params.get("mode") as InterviewMode) ? params.get("mode") : "STANDARD") as InterviewMode;
  const experience = EXPERIENCE_LEVELS.includes(params.get("experience") as ExperienceLevel) ? (params.get("experience") as ExperienceLevel) : undefined;
  const voiceName = params.get("voice");

  const [phase, setPhase] = useState<Phase>("preflight");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [caption, setCaption] = useState("");
  const [kind, setKind] = useState<TurnKind>("question");
  const [turnKeyPoints, setTurnKeyPoints] = useState<string[]>([]);
  const [turnNumber, setTurnNumber] = useState(1);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [accent, setAccent] = useState("en-US");
  const [aiVoices, setAiVoices] = useState(false);
  const [aiChecked, setAiChecked] = useState(false);
  const [quality, setQuality] = useState<TranscriptionQuality>("standard");
  const transcriber = useLocalTranscriber();
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [answer, setAnswer] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [dictationEnabled, setDictationEnabled] = useState(true);
  const [ttsMuted, setTtsMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [pending, setPending] = useState<RespondResponse | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  /** True only while the interviewer's audio is actually playing (drives the avatar's mouth). */
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const fillersRef = useRef(0);
  const startedAtRef = useRef<number>(0);
  const answerBaseRef = useRef("");
  const recorderRef = useRef<AnswerRecorder | null>(null);
  /** Text confirmed before the current spoken segment (after a review, more speech is appended). */
  const segmentBaseRef = useRef("");
  /** Whether the submitted text came from accurate (Whisper/Gemini) transcription. */
  const refinedRef = useRef(false);
  /** On-device transcriptions of speech segments, started while the candidate is still talking. */
  const segmentJobsRef = useRef<Promise<string | null>[]>([]);
  const ttsMutedRef = useRef(false);
  useEffect(() => {
    ttsMutedRef.current = ttsMuted;
  }, [ttsMuted]);

  const analyzer = useInterviewAnalyzer(videoRef);
  const dictationSupported = speechRecognitionSupported();
  const live = phase !== "preflight" && phase !== "finishing";

  useEffect(() => {
    void loadVoices().then((voices) => {
      voiceRef.current = pickVoice(voices, voiceName, company.interviewer.voice);
    });
    void serverVoicesAvailable().then((available) => {
      setAiVoices(available);
      setAiChecked(true);
    });
    // Accent and transcription preferences live in localStorage, so read them after mount.
    const saved = getSpeechLang();
    const savedQuality = getTranscriptionQuality();
    queueMicrotask(() => {
      setAccent(saved);
      setQuality(savedQuality);
    });
  }, [voiceName, company.interviewer.voice]);

  // Download the on-device transcription model in the background. It transcribes
  // while the candidate talks, so the answer is ready the moment they stop.
  useEffect(() => {
    if (aiChecked && quality !== "off") localTranscriber.prepare();
  }, [aiChecked, quality]);

  // Elapsed timer while the session is live.
  useEffect(() => {
    if (!live || !startedAtRef.current) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [live]);

  // Warn before leaving an in-progress session.
  useEffect(() => {
    if (!live) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [live]);

  // Release media on unmount.
  useEffect(
    () => () => {
      speechAbortRef.current?.abort();
      cancelSpeech();
      recognizerRef.current?.stop();
      recorderRef.current?.dispose();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraOn(true);
    } catch {
      setCameraError("Camera access was blocked. You can continue without it.");
      setCameraOn(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  // Re-attach the stream when the video element remounts between phases.
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [cameraOn, phase]);

  const startDictation = useCallback(
    (base = "") => {
    if (!dictationSupported) return;
    recognizerRef.current?.stop();
    // Dictated text is appended to whatever the candidate had already written.
    answerBaseRef.current = base.trim();
    recognizerRef.current = createRecognizer({
      onText: (finalText, interimText) => {
        const prefix = answerBaseRef.current;
        setAnswer(prefix ? `${prefix} ${finalText}`.trim() : finalText);
        setInterim(interimText);
      },
      onStateChange: setListening,
      onError: (message) => {
        setDictationEnabled(false);
        toast.error("Dictation unavailable", message);
      },
    });
    recognizerRef.current?.start();
    },
    [dictationSupported, toast]
  );

  const stopDictation = useCallback(() => {
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setInterim("");
    setListening(false);
  }, []);

  const speakAsInterviewer = useCallback(
    (text: string, signal: AbortSignal, move?: "opening" | "question" | "followup" | "coaching" | "closing") =>
      speak(text, {
        voice: voiceRef.current,
        rate: 0.97,
        signal,
        muted: ttsMutedRef.current,
        serverVoice: AI_VOICE[company.interviewer.voice],
        hint: {
          move,
          mode,
          role: "interviewer",
          persona: { name: company.interviewer.name.split(" ")[0], trait: `a ${company.interviewer.title.toLowerCase()} at ${company.name}` },
        },
        // The opening keeps the same neutral delivery as the live interview
        // instead of switching to a separate, overly-performed greeting style.
        emotion: move === "opening" ? "neutral" : undefined,
        onPhrase: (phrase) => setCaption(phrase),
        onSpeakingChange: setInterviewerSpeaking,
      }),
    [company.interviewer.voice, company.interviewer.name, company.interviewer.title, company.name, mode]
  );

  const ask = useCallback(
    async (turn: TurnPayload) => {
      setQuestion(turn.prompt);
      setKind(turn.kind);
      setTurnKeyPoints(turn.keyPoints);
      setTurnNumber(turn.turnNumber);
      setQuestionNumber(turn.questionNumber);
      setTotalQuestions(turn.totalQuestions);
      setAnswer("");
      setInterim("");
      setCaption("");
      setPhase("asking");
      speechAbortRef.current = new AbortController();
      await speakAsInterviewer(turn.question, speechAbortRef.current.signal, turn.turnNumber <= 1 ? "opening" : turn.kind);
      setInterviewerSpeaking(false);
      setCaption("");
      refinedRef.current = false;
      await beginSpeaking("");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- beginSpeaking is stable per render inputs listed below
    [speakAsInterviewer, dictationEnabled, aiVoices, quality]
  );

  const finish = useCallback(
    async (id: string) => {
      setPhase("finishing");
      stopDictation();
      speechAbortRef.current?.abort();
      recorderRef.current?.dispose();
      recorderRef.current = null;
      const summary = analyzer.getSummary();
      // Only report what was actually measured: at least 15 s of camera time.
      const hasVideoSignal = summary.measuredSec >= 15;
      try {
        await api("/api/interview", {
          method: "POST",
          timeoutMs: 60_000,
          body: {
            action: "complete",
            sessionId: id,
            durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
            metrics: {
              fillerWords: fillersRef.current,
              ...(hasVideoSignal
                ? {
                    eyeContact: summary.eyeContactScore,
                    smile: summary.smilePercentage,
                    facePresence: summary.facePresence,
                    cameraSec: summary.measuredSec,
                    ...(summary.postureMeasured ? { posture: summary.postureScore } : {}),
                  }
                : {}),
            },
          },
        });
        stopCamera();
        router.replace(`/interview/results?id=${id}`);
      } catch (error) {
        toast.error("Couldn't finalize the evaluation", errorMessage(error));
        setPhase("answering");
      }
    },
    [analyzer, router, stopCamera, stopDictation, toast]
  );

  async function begin() {
    // Audio playback must be unlocked inside the click that starts the interview.
    unlockAudio();
    setPhase("starting");
    startedAtRef.current = Date.now();
    try {
      const jd = readJobDescription();
      const res = await api<StartResponse>("/api/interview", {
        method: "POST",
        timeoutMs: 45_000,
        body: { action: "start", company: company.id, mode, ...(experience ? { experienceLevel: experience } : {}), ...(jd ? { jobDescription: jd } : {}) },
      });
      setSessionId(res.sessionId);
      await ask(res);
    } catch (error) {
      toast.error("Couldn't start the interview", errorMessage(error));
      setPhase("preflight");
    }
  }

  function proceed(res: RespondResponse) {
    if (!sessionId) return;
    if (res.done) void finish(sessionId);
    else void ask(res);
  }

  const accurateTranscription = aiVoices || quality !== "off";


  /** Start (or continue) a spoken segment: live captions plus a recording for accurate transcription. */
  async function beginSpeaking(base: string) {
    segmentBaseRef.current = base.trim();
    setPhase("answering");
    if (!dictationEnabled || !dictationSupported) return;
    startDictation(base);
    if (accurateTranscription) {
      recorderRef.current?.dispose();
      segmentJobsRef.current = [];
      const recorder = new AnswerRecorder();
      // Transcribe each finished sentence group on the device while the candidate keeps
      // talking, so only the last few seconds remain when they finish.
      const onSegment =
        quality !== "off"
          ? (pcm: Float32Array) => {
              segmentJobsRef.current.push(localTranscriber.transcribe(pcm).catch(() => null));
            }
          : undefined;
      if (await recorder.start({ onSegment })) recorderRef.current = recorder;
    }
  }

  /** On-device Whisper text for the recorded answer (segments already done while speaking + the tail). */
  async function localTranscript(tail: Float32Array | null): Promise<string | null> {
    const earlier = segmentJobsRef.current;
    segmentJobsRef.current = [];
    if (quality === "off" || (!earlier.length && !tail)) return null;
    const parts = await Promise.all([...earlier, tail ? localTranscriber.transcribe(tail).catch(() => null) : Promise.resolve("")]);
    if (parts.every((p) => p === null)) return null;
    return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || null;
  }

  /**
   * Gemini transcription of the whole answer, with the question as context so
   * technical terms and Indian-English accents come out right. Bounded: if it
   * isn't back within the budget, the on-device text is used instead.
   */
  async function geminiTranscript(full: Float32Array | null, budgetMs: number): Promise<string | null> {
    if (!aiVoices || !full) return null;
    try {
      const label = SPEECH_LANGS.find((l) => l.code === accent)?.label;
      const res = await api<{ text: string }>("/api/transcribe", {
        method: "POST",
        timeoutMs: budgetMs,
        body: { audio: wavBase64(full), accent: label, question },
      });
      return res.text.trim() || null;
    } catch {
      return null;
    }
  }

  /** Stop listening, transcribe the answer accurately, then open it for review and editing. */
  async function finishSpeaking() {
    const live = `${answer} ${interim}`.trim();
    stopDictation();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    const { tail, full } = recorder?.stopAll() ?? { tail: null, full: null };
    setAnswer(live);
    setInterim("");
    if (!tail && !full && !segmentJobsRef.current.length) {
      setPhase("reviewing");
      return;
    }
    setPhase("transcribing");
    const base = segmentBaseRef.current;
    const liveSegment = live.startsWith(base) ? live.slice(base.length).trim() : live;
    const liveWords = liveSegment.split(/\s+/).filter(Boolean).length;
    // Both run at once: Gemini (best accuracy, with the question as context) and
    // Whisper on the device (always available). Gemini wins if it answers in time.
    const stoppedAt = Date.now();
    const gemini = geminiTranscript(full, 9000);
    const localText = await localTranscript(tail);
    // With on-device text in hand, give Gemini at most ~5 s from the stop, then move on.
    const waitMs = localText ? Math.max(600, 5000 - (Date.now() - stoppedAt)) : 9000;
    const geminiText = await Promise.race([gemini, new Promise<null>((r) => setTimeout(() => r(null), waitMs))]);
    const accurate = geminiText ?? localText;
    // Trust the accurate transcript unless it heard far less than the live captions did.
    if (accurate && accurate.split(/\s+/).length >= liveWords * 0.5) {
      setAnswer(base ? `${base} ${accurate}` : accurate);
      refinedRef.current = true;
    } else if (!accurate) {
      toast.notify({ tone: "info", title: "Using live captions", description: "Check the text below and fix anything that was misheard." });
    }
    setPhase("reviewing");
  }

  async function submit() {
    const text = `${answer} ${interim}`.trim();
    if (!sessionId || !text) return;
    stopDictation();
    recorderRef.current?.dispose();
    recorderRef.current = null;
    segmentJobsRef.current = [];
    const refined = refinedRef.current;
    setPhase("submitting");
    try {
      const body = { action: "respond" as const, sessionId, questionNumber: turnNumber, answer: text, ...(refined ? { refined: true } : {}) };
      let res: RespondResponse;
      try {
        res = await api<RespondResponse>("/api/interview", { method: "POST", timeoutMs: 90_000, body });
      } catch (firstError) {
        // The server claims the answer before generating the next turn. A
        // transient connection loss can therefore leave the answer saved even
        // though the response was lost; retry once, relying on the server's
        // turn/concurrency checks to prevent a duplicate answer.
        if (!(firstError instanceof ApiClientError) || !["NETWORK", "TIMEOUT"].includes(firstError.code)) throw firstError;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        res = await api<RespondResponse>("/api/interview", { method: "POST", timeoutMs: 90_000, body });
      }
      fillersRef.current += countFillers(text);
      if (res.feedback) {
        setFeedback(res.feedback);
        setPending(res);
        setPhase("feedback");
      } else {
        proceed(res);
      }
    } catch (error) {
      // The server already recorded this answer (e.g. a retried request) — move on safely.
      if (error instanceof ApiClientError && (error.code === "NOT_YOUR_TURN" || error.code === "CONCURRENT_UPDATE")) {
        toast.notify({ tone: "info", title: "Answer already recorded", description: "Wrapping up this question." });
        void finish(sessionId);
        return;
      }
      toast.error("Your answer wasn't submitted", `${errorMessage(error)} Your text is preserved — try again.`);
      setPhase("reviewing");
    }
  }

  const progress = ((questionNumber - (["answering", "asking", "transcribing", "reviewing"].includes(phase) ? 1 : 0)) / totalQuestions) * 100;
  const editable = phase === "answering" || phase === "reviewing";
  const busy = phase === "submitting" || phase === "transcribing";
  const wordCount = `${answer} ${interim}`.trim().split(/\s+/).filter(Boolean).length;

  // ── Preflight ───────────────────────────────────────────────────────────────
  if (phase === "preflight" || phase === "starting") {
    return (
      <div className="room-backdrop min-h-dvh">
        <header className="flex h-14 items-center justify-between border-b bg-background/70 px-6 backdrop-blur-md">
          <Brand />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/interview/setup">Back to setup</Link>
          </Button>
        </header>
        <main className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <p className="eyebrow">Pre-interview check</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {company.interviewer.name} is ready <span className="font-display text-[1.15em] font-normal italic">when you are.</span>
            </h1>
            <div className={cn("mt-6 aspect-video overflow-hidden rounded-xl border shadow-panel", cameraOn ? "bg-black" : "camera-placeholder")}>
              <video ref={videoRef} autoPlay muted playsInline className={cn("h-full w-full object-cover -scale-x-100", !cameraOn && "hidden")} />
              {!cameraOn && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/70">
                  <CameraOff className="size-6" />
                  <p className="max-w-xs text-[13px]">Enable your camera to receive eye-contact and posture feedback. Video is processed on your device and never uploaded.</p>
                  <Button size="sm" variant="secondary" onClick={startCamera}>
                    <Camera /> Enable camera
                  </Button>
                  {cameraError && <p className="text-[12px] text-warning">{cameraError}</p>}
                </div>
              )}
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-medium">{company.name} · {MODE_LABELS[mode].label}</p>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{MODE_LABELS[mode].detail}</p>
              <ul className="mt-4 space-y-2 border-t pt-4 text-[13px]">
                <li className="flex items-center gap-2">
                  {cameraOn ? <Check className="size-3.5 text-success" /> : <span className="size-3.5 rounded-full border" />}
                  Camera {cameraOn ? "connected" : "optional"}
                </li>
                <li className="flex items-center gap-2">
                  {dictationSupported ? <Check className="size-3.5 text-success" /> : <span className="size-3.5 rounded-full border" />}
                  {dictationSupported ? "Voice dictation available" : "Dictation unsupported — type your answers"}
                </li>
                <li className="flex items-center gap-2">
                  {aiVoices ? <Check className="size-3.5 text-success" /> : <Volume2 className="size-3.5 text-muted-foreground" />}
                  {aiVoices ? "Natural AI voice and accurate transcription" : "Questions are read aloud"}
                </li>
              </ul>
              {dictationSupported && !aiVoices && quality !== "off" && (
                <div className="mt-4 rounded-md border bg-background/60 px-3 py-2.5 text-[12px] leading-5">
                  <p className="flex items-center gap-1.5 font-medium">
                    {transcriber.status === "ready" ? <Check className="size-3.5 text-success" /> : <Spinner className="size-3.5" />}
                    {transcriber.status === "ready"
                      ? "Accurate transcription ready"
                      : transcriber.status === "error" || transcriber.status === "unsupported"
                        ? "Accurate transcription unavailable — live captions will be used"
                        : `Preparing accurate transcription · ${transcriber.progress}%`}
                  </p>
                  {transcriber.status === "loading" && (
                    <>
                      <ProgressBar value={transcriber.progress} className="mt-2" label="Transcription model download" />
                      <p className="mt-1.5 text-muted-foreground">
                        One-time download ({TRANSCRIPTION_OPTIONS[quality].sizeMb} MB), then cached. You can start now; it finishes in the background.
                      </p>
                    </>
                  )}
                </div>
              )}
              {dictationSupported && (
                <div className="mt-4 border-t pt-4">
                  <label htmlFor="accent" className="flex items-center gap-1.5 text-[13px] font-medium">
                    <Languages className="size-3.5 text-muted-foreground" /> Your accent
                  </label>
                  <select
                    id="accent"
                    value={accent}
                    onChange={(e) => {
                      setAccent(e.target.value);
                      setSpeechLang(e.target.value);
                    }}
                    className="mt-1.5 h-9 w-full rounded-md border bg-background px-2.5 text-[13px]"
                  >
                    {SPEECH_LANGS.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">Matching your accent makes dictation noticeably more accurate.</p>
                  {recognitionIsDelayed() && (
                    <p className="mt-2 rounded-md bg-warning-soft px-2.5 py-2 text-[12px] leading-5 text-warning">
                      Edge only shows your words after each pause. For live word-by-word captions, use Google Chrome.
                    </p>
                  )}
                </div>
              )}
              <Button className="mt-5 w-full" onClick={begin} disabled={phase === "starting"}>
                {phase === "starting" ? <Spinner className="text-primary-foreground" /> : null}
                {phase === "starting" ? "Connecting to interviewer" : "Begin interview"}
                {phase !== "starting" && <ArrowRight />}
              </Button>
            </div>
            <p className="text-[12px] leading-5 text-subtle">
              Answer as you would in a real loop: state context, explain your reasoning and trade-offs, and close with a measurable result.
            </p>
          </aside>
        </main>
      </div>
    );
  }

  // ── Live room ───────────────────────────────────────────────────────────────
  return (
    <div className="room-backdrop flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background/70 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <span className="size-2 rounded-full bg-danger" aria-hidden />
          <span className="text-[13px] font-medium">{company.name} interview</span>
          <Badge variant="outline" className="hidden sm:inline-flex">{MODE_LABELS[mode].label}</Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-[12px] text-muted-foreground sm:inline">Question {questionNumber} of {totalQuestions}</span>
          <ProgressBar value={progress} className="hidden w-28 sm:block" label="Interview progress" />
          <span className="font-mono text-[12px] tabular text-muted-foreground">{fmtTime(elapsed)}</span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Left: interviewer + question */}
        <section className="flex flex-col gap-4" aria-label="Interviewer">
          <InterviewerTile
            gender={company.interviewer.voice}
            speaking={interviewerSpeaking}
            thinking={phase === "submitting" || phase === "finishing"}
            name={company.interviewer.name}
            title={`${company.interviewer.title} · ${company.name}`}
          />
          {phase === "asking" && caption && (
            <p key={caption} className="room-panel animate-blur-in rounded-xl px-4 py-3 text-[14px] leading-6 text-muted-foreground" aria-hidden>
              {caption}
            </p>
          )}
          <div key={turnNumber} className="room-panel animate-pop-in rounded-xl p-5" aria-live="polite">
            <div className="flex items-center gap-2">
              <p className="eyebrow">
                {kind === "question" ? `Question ${questionNumber}` : `${KIND_LABEL[kind]} · Question ${questionNumber}`}
              </p>
              {kind !== "question" && (
                <Badge variant="outline" className={cn("gap-1", kind === "coaching" && "border-accent/40 text-accent")}>
                  {kind === "coaching" ? <Sparkles className="size-3" /> : null}
                  {kind === "coaching" ? "Hints given" : "On your project"}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-[17px] leading-7">{question}</p>
            {kind === "coaching" && turnKeyPoints.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t pt-3">
                {turnKeyPoints.map((k, i) => (
                  <li key={k} className="animate-blur-in flex gap-2 text-[13px] leading-5 text-muted-foreground" style={{ animationDelay: `${i * 120}ms` }}>
                    <BookOpen className="mt-0.5 size-3.5 shrink-0 text-accent" />
                    {k}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Right: candidate */}
        <section className="flex flex-col gap-4" aria-label="Your answer">
          <div className={cn("relative aspect-video overflow-hidden rounded-xl border shadow-panel", cameraOn ? "bg-black" : "camera-placeholder")}>
            <video ref={videoRef} autoPlay muted playsInline className={cn("h-full w-full object-cover -scale-x-100", !cameraOn && "hidden")} />
            {!cameraOn && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-white/85">
                <span className="flex size-12 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <CameraOff className="size-5" />
                </span>
                <span className="text-[13px] font-medium">Camera off</span>
                <span className="text-[11.5px] text-white/65">Turn it on below for eye-contact and posture feedback</span>
              </div>
            )}
            {cameraOn && analyzer.isReady && (
              <div className="absolute left-2 top-2 flex flex-wrap gap-1.5 text-[11px]">
                {!analyzer.calibrated ? (
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-white">Calibrating — look at the screen</span>
                ) : !analyzer.faceVisible ? (
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-warning">Face not in frame</span>
                ) : (
                  <>
                    <span className={cn("inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5", analyzer.isMakingEyeContact ? "text-white" : "text-warning")}>
                      <Eye className="size-3" /> {analyzer.isMakingEyeContact ? "Eye contact" : "Look at the screen"}
                      <span className="tabular text-white/60">· {analyzer.eyeContactScore}%</span>
                    </span>
                    <span className={cn("rounded bg-black/60 px-1.5 py-0.5", analyzer.postureIssue ? "text-warning" : "text-white")}>
                      {analyzer.postureIssue === "uneven-shoulders"
                        ? "Level your shoulders"
                        : analyzer.postureIssue === "slouching"
                          ? "Sit up straight"
                          : analyzer.postureIssue === "too-close"
                            ? "Lean back a little"
                            : "Posture good"}
                      {analyzer.postureMeasured && <span className="tabular text-white/60"> · {analyzer.postureScore}%</span>}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="room-panel flex flex-1 flex-col rounded-xl p-4">
            <div className="flex items-center justify-between">
              <label htmlFor="answer" className="text-[13px] font-medium">Your answer</label>
              <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                {listening && (
                  <span className="inline-flex items-center gap-1.5 text-danger">
                    <span className="size-1.5 animate-pulse rounded-full bg-danger" /> Listening
                  </span>
                )}
                {!aiVoices && quality !== "off" && transcriber.status === "loading" && (
                  <span title="One-time download for accurate transcription">Preparing accurate transcription {transcriber.progress}%</span>
                )}
                <span className="font-mono tabular">{wordCount} words</span>
              </span>
            </div>
            {phase === "transcribing" && (
              <p className="animate-blur-in mt-2 flex items-center gap-2 rounded-md bg-accent-soft px-3 py-2 text-[12.5px] text-accent" role="status">
                <Spinner className="text-current" />
                Transcribing your answer accurately{aiVoices ? "" : " on your device"}…
              </p>
            )}
            {phase === "reviewing" && (
              <p className="animate-blur-in mt-2 flex items-start gap-2 rounded-md bg-accent-soft px-3 py-2 text-[12.5px] leading-5 text-accent">
                <Pencil className="mt-0.5 size-3.5 shrink-0" />
                Check your answer. Fix anything we misheard, keep speaking to add more, then submit.
              </p>
            )}
            <Textarea
              id="answer"
              value={interim ? `${answer} ${interim}`.trim() : answer}
              onChange={(e) => {
                // Typing takes over from dictation so the two never fight.
                if (listening) {
                  stopDictation();
                  recorderRef.current?.dispose();
                  recorderRef.current = null;
                  segmentJobsRef.current = [];
                  setPhase("reviewing");
                }
                setInterim("");
                setAnswer(e.target.value);
              }}
              disabled={!editable}
              aria-busy={phase === "transcribing"}
              autoFocus={phase === "reviewing"}
              placeholder={
                phase === "asking"
                  ? "Listen to the question…"
                  : dictationEnabled && dictationSupported
                    ? "Start speaking — your words appear here as you talk."
                    : "Type your answer."
              }
              className={cn(
                "mt-2 min-h-40 flex-1 resize-none px-0 focus-visible:ring-0",
                phase === "reviewing" ? "rounded-md border border-accent/40 px-3 py-2" : "border-0"
              )}
            />
          </div>
        </section>
      </main>

      {/* Control bar */}
      <footer className="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          {dictationSupported && (
            <Button
              variant={listening ? "secondary" : "outline"}
              size="icon"
              onClick={() => {
                if (listening) void finishSpeaking();
                else {
                  setDictationEnabled(true);
                  void beginSpeaking(answer);
                }
              }}
              disabled={!editable}
              aria-label={listening ? "Stop and review" : "Speak"}
              title={listening ? "Stop and review" : "Speak"}
            >
              {listening ? <Mic /> : <MicOff />}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => (cameraOn ? stopCamera() : void startCamera())}
            aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
            title={cameraOn ? "Turn camera off" : "Turn camera on"}
          >
            {cameraOn ? <Camera /> : <CameraOff />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setTtsMuted((m) => !m);
              if (!ttsMuted) speechAbortRef.current?.abort();
            }}
            aria-label={ttsMuted ? "Unmute interviewer" : "Mute interviewer"}
            title={ttsMuted ? "Unmute interviewer" : "Mute interviewer"}
          >
            {ttsMuted ? <VolumeX /> : <Volume2 />}
          </Button>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                speechAbortRef.current = new AbortController();
                void speakAsInterviewer(question, speechAbortRef.current.signal);
              }}
            >
              <RotateCcw /> Repeat question
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {confirmEnd ? (
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-[13px]">
              End now? Answers so far will be scored.
              <Button size="sm" variant="destructive" onClick={() => sessionId && void finish(sessionId)}>End interview</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmEnd(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(true)} disabled={!sessionId || phase === "finishing"}>
              <PhoneOff /> End
            </Button>
          )}
          {phase === "answering" && listening ? (
            <Button onClick={() => void finishSpeaking()}>
              <Pencil /> Done speaking — review
            </Button>
          ) : (
            <>
              {phase === "reviewing" && dictationSupported && (
                <Button variant="outline" onClick={() => void beginSpeaking(answer)}>
                  <Mic /> Keep speaking
                </Button>
              )}
              <Button onClick={submit} disabled={!editable || wordCount < 2}>
                {busy ? <Spinner className="text-primary-foreground" /> : null}
                {phase === "transcribing" ? "Transcribing" : phase === "submitting" ? "Interviewer is responding" : "Submit answer"}
              </Button>
            </>
          )}
        </div>
      </footer>

      {phase === "finishing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm" role="status">
          <div className="text-center">
            <Spinner className="mx-auto size-5" />
            <p className="mt-3 text-sm font-medium">Evaluating your interview</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Scoring every answer against the rubric for your track.</p>
          </div>
        </div>
      )}

      {phase === "feedback" && feedback && pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="fb-title">
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-popover p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Coached feedback · Question {questionNumber}</p>
                <h2 id="fb-title" className="mt-1 text-lg font-semibold">How that answer landed</h2>
              </div>
              <span className="font-mono text-2xl font-semibold tabular">
                {feedback.score}
                <span className="text-sm text-muted-foreground">/100</span>
              </span>
            </div>
            <div className="mt-5 space-y-4 text-[14px] leading-6">
              <div>
                <p className="eyebrow mb-1.5">A stronger answer</p>
                <p className="rounded-md border bg-card px-4 py-3">{feedback.idealAnswer}</p>
              </div>
              {feedback.corrections.length > 0 && (
                <div>
                  <p className="eyebrow mb-1.5">Specific fixes</p>
                  <ul className="space-y-1.5">
                    {feedback.corrections.map((c) => (
                      <li key={c} className="flex gap-2 text-muted-foreground"><span className="mt-2.5 size-1 shrink-0 rounded-full bg-warning" />{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.keyPoints.length > 0 && (
                <div>
                  <p className="eyebrow mb-1.5">Key points to study</p>
                  <ul className="space-y-1.5">
                    {feedback.keyPoints.map((k) => (
                      <li key={k} className="flex gap-2 text-muted-foreground"><BookOpen className="mt-1 size-3.5 shrink-0 text-accent" />{k}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.tip && <p className="border-l-2 border-accent pl-3 text-muted-foreground">{feedback.tip}</p>}
              {feedback.source === "heuristic" && (
                <p className="text-[11px] text-subtle">Scored with the offline rubric. Configure Gemini for model-graded feedback.</p>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => {
                  setFeedback(null);
                  setPending(null);
                  proceed(pending);
                }}
              >
                {pending.done ? "See full evaluation" : "Next question"} <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterviewSessionPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><Spinner /></div>}>
      <Room />
    </Suspense>
  );
}
