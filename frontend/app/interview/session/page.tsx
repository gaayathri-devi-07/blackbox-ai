"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Send,
  AlertCircle, CheckCircle, Eye, Smile, Activity,
  ChevronRight, Maximize, Loader2,
} from "lucide-react";
import { doc, increment, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/lib/userStore";
import { useInterviewAnalyzer } from "@/hooks/useInterviewAnalyzer";

// ─── Constants ───────────────────────────────────────────────────────────────

const COMPANY_PERSONAS: Record<string, {
  name: string;
  title: string;
  color: string;
  bg: string;
  initials: string;
  gender: "male" | "female";
}> = {
  google:    { name: "Alex Chen",     title: "Senior Software Engineer, Google",  color: "#4285F4", bg: "#0d1f40", initials: "AC", gender: "male" },
  amazon:    { name: "Sarah Kim",     title: "Engineering Manager, Amazon",       color: "#FF9900", bg: "#2a1800", initials: "SK", gender: "female" },
  microsoft: { name: "James Wright",  title: "Principal Engineer, Microsoft",     color: "#00A4EF", bg: "#001a2e", initials: "JW", gender: "male" },
  apple:     { name: "Maya Patel",    title: "Senior Engineer, Apple",            color: "#aaaaaa", bg: "#1a1a1a", initials: "MP", gender: "female" },
  deloitte:  { name: "Ryan Thompson", title: "Senior Consultant, Deloitte",       color: "#86BC25", bg: "#111a00", initials: "RT", gender: "male" },
  tcs:       { name: "Priya Sharma",  title: "Technical Lead, TCS",               color: "#0073CF", bg: "#00112a", initials: "PS", gender: "female" },
  accenture: { name: "Jordan Lee",    title: "Senior Manager, Accenture",         color: "#A100FF", bg: "#1a0030", initials: "JL", gender: "male" },
};

const DEFAULT_PERSONA = {
  name: "Alex Rivera",
  title: "Senior Interviewer",
  color: "#7c3aed",
  bg: "#100020",
  initials: "AR",
  gender: "male" as const,
};

const COMPANY_LOGOS: Record<string, string> = {
  google: "🔵", amazon: "🟠", microsoft: "🔷", apple: "⬜",
  deloitte: "🟢", tcs: "🔵", accenture: "🟣",
};

const ENCOURAGEMENTS = [
  "You're doing great, stay confident! 💪",
  "Nice answer! Keep up the energy 🌟",
  "I noticed great eye contact — keep that up 👀",
  "Sit up straight and speak with confidence 🎯",
  "Remember to breathe and take your time 🌬️",
  "Your communication is coming through clearly 👍",
  "Great storytelling approach! Keep it up 📖",
  "Smile a bit — it shows confidence 😊",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "preflight" | "interview" | "practice-feedback" | "complete";
type Msg = { role: "user" | "assistant"; content: string };
type SavedSession = {
  timestamp: number;
  company: string;
  role: string;
  experience: string;
  mode: string;
  finalScore: number;
  eyeContact: number;
  postureScore?: number;
  smilePercentage?: number;
  fillerWords: number;
  answerScores: number[];
  transcript: Msg[];
};

interface FeedbackData {
  idealAnswer: string;
  corrections: string[];
  score: number;
  tip: string;
}

// ─── Video Avatar ─────────────────────────────────────────────────────────────

// ✅ REPLACE WITH THIS
function PhotoAvatar({
  persona,
  isSpeaking,
  isThinking,
  company,
}: {
  persona: {
    name: string;
    title: string;
    color: string;
    bg: string;
    initials: string;
    gender: "male" | "female";
  };
  isSpeaking: boolean;
  isThinking: boolean;
  company: string;
}) {
  const interviewer =
    (COMPANY_PERSONAS[company]?.gender ?? persona.gender) === "female"
      ? "female"
      : "male";
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.src = isSpeaking
      ? interviewer === "male" ? "/mentalk.mp4" : "/womentalk.mp4"
      : interviewer === "male" ? "/menblink.mp4" : "/womenblink.mp4";
    vid.load();
    vid.play().catch(() => {});
  }, [isSpeaking, interviewer]);

  return (
    <>
      {isSpeaking && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none z-10"
          style={{ boxShadow: `inset 0 0 40px 8px ${persona.color}33` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      <motion.div
        className="absolute inset-0"
        animate={isSpeaking ? { scale: [1, 1.005, 1] } : { scale: 1 }}
        transition={{ duration: 0.8, repeat: isSpeaking ? Infinity : 0 }}
      >
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        {isSpeaking && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `${persona.color}0d` }}
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
      </motion.div>

      {isThinking && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-20">
          <div className="flex gap-1.5">
            {[0, 0.15, 0.3].map((d, i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: persona.color }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: d }}
              />
            ))}
          </div>
        </div>
      )}

      <div
        className="absolute inset-x-0 bottom-0 h-28 pointer-events-none z-10"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)",
        }}
      />

      <div className="absolute bottom-3 left-4 right-4 z-20 flex items-end justify-between">
        <div>
          <p className="text-sm font-bold text-white drop-shadow">
            {persona.name}
          </p>
          <p className="text-xs text-white/60">{persona.title}</p>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="text-xs">{COMPANY_LOGOS[company] ?? "🏢"}</span>
            <span className="text-xs text-white/40 capitalize">{company}</span>
          </div>
        </div>
        {isSpeaking && !isThinking && (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
            style={{
              background: persona.color,
              color: "#fff",
              boxShadow: `0 0 12px ${persona.color}88`,
            }}
          >
            <Activity className="w-3 h-3" />
            Speaking
          </div>
        )}
      </div>
    </>
  );
}

// ─── Pre-flight screen ────────────────────────────────────────────────────────

function PreflightScreen({
  company,
  persona,
  onReady,
}: {
  company: string;
  persona: {                          // ← replace with this
    name: string;
    title: string;
    color: string;
    bg: string;
    initials: string;
    gender: "male" | "female";
  };
  onReady: () => void;
}) {
  const [camOk, setCamOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [fsOk, setFsOk] = useState(false);
  const [camError, setCamError] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRequestingRef = useRef(false);

  const checkCamMic = useCallback(async () => {
    if (streamRef.current) {
      if (previewRef.current) {
        previewRef.current.srcObject = streamRef.current;
        previewRef.current.play().catch(() => null);
      }
      setCamOk(true);
      setMicOk(true);
      return;
    }
    if (isRequestingRef.current) return;
    isRequestingRef.current = true;
    setCamError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        previewRef.current.play().catch(() => null);
      }
      setCamOk(true);
      setMicOk(true);
    } catch (err: any) {
      console.error("Camera/mic error:", err);
      // Check if it's a permission denied error
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCamError(true);
      } else {
        setCamError(true);
      }
    } finally {
      isRequestingRef.current = false;
    }
  }, []);

  const requestFullscreen = useCallback(() => {
    document.documentElement
      .requestFullscreen?.()
      .then(() => setFsOk(true))
      .catch(() => setFsOk(true));
  }, []);

  useEffect(() => {
    if (camOk && previewRef.current && streamRef.current) {
      previewRef.current.srcObject = streamRef.current;
      previewRef.current.play().catch(() => null);
    }
  }, [camOk]);

  useEffect(() => {
    checkCamMic();
  }, [checkCamMic]);

  const allReady = camOk && micOk;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050012] text-slate-900 dark:text-white transition-colors duration-300 flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black mx-auto mb-3"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${persona.color}cc, ${persona.color}55)`,
              border: `2px solid ${persona.color}`,
            }}
          >
            {persona.initials}
          </div>
          <h2 className="text-xl font-bold" style={{ color: persona.color }}>
            {persona.name}
          </h2>
          <p className="text-sm text-slate-600 dark:text-white/50">
            Your interviewer is ready for you…
          </p>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 aspect-video mb-6">
          <video
            ref={previewRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
          {!camOk && !camError && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 dark:text-white/40 text-sm">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Requesting
              camera…
            </div>
          )}
          {camError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-gradient-to-br from-red-900/30 to-orange-900/20 backdrop-blur-sm">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div className="text-center">
                <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-2">
                  Camera & Mic Access Required
                </h3>
                <p className="text-slate-700 dark:text-white/70 text-sm max-w-xs mb-4">
                  Please allow camera and microphone permissions in your browser to continue with the interview.
                </p>
                <div className="bg-white/60 dark:bg-black/40 rounded-lg p-3 text-xs text-slate-700 dark:text-white/60 text-left mb-4">
                  <p className="font-semibold text-slate-900 dark:text-white/80 mb-1">How to enable:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Click the camera icon in your browser's address bar</li>
                    <li>Select "Allow" for camera and microphone</li>
                    <li>Click "Retry" below</li>
                  </ol>
                </div>
              </div>
              <button
                onClick={checkCamMic}
                className="px-6 py-2.5 rounded-full font-bold bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white transition-all shadow-lg hover:shadow-xl"
              >
                Retry Access
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3 mb-6">
          {[
            {
              ok: camOk,
              label: "Camera access granted",
              icon: <Video className="w-4 h-4" />,
            },
            {
              ok: micOk,
              label: "Microphone access granted",
              icon: <Mic className="w-4 h-4" />,
            },
            {
              ok: fsOk,
              label: "Full-screen mode",
              icon: <Maximize className="w-4 h-4" />,
              action: requestFullscreen,
              actionLabel: "Go fullscreen",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
            >
              <div className={item.ok ? "text-green-400" : "text-slate-500 dark:text-white/30"}>
                {item.icon}
              </div>
              <span
                className={`flex-1 text-sm ${
                  item.ok ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-white/50"
                }`}
              >
                {item.label}
              </span>
              {item.ok ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : item.action ? (
                <button
                  onClick={item.action}
                  className="text-xs text-purple-400 hover:underline"
                >
                  {item.actionLabel}
                </button>
              ) : camError ? (
                <button
                  onClick={checkCamMic}
                  className="text-xs text-red-400 hover:underline"
                >
                  Retry
                </button>
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500 dark:text-white/30" />
              )}
            </div>
          ))}
        </div>

        <motion.button
          whileHover={allReady ? { scale: 1.03 } : {}}
          whileTap={allReady ? { scale: 0.97 } : {}}
          onClick={onReady}
          disabled={!allReady}
          className="w-full py-4 rounded-2xl font-bold text-lg tracking-wide transition-all"
          style={{
            background: allReady
              ? `linear-gradient(135deg, ${persona.color}, ${persona.color}88)`
              : "rgba(255,255,255,0.06)",
            color: allReady ? "#fff" : "rgba(255,255,255,0.25)",
            cursor: allReady ? "pointer" : "not-allowed",
            boxShadow: allReady ? `0 0 40px ${persona.color}44` : "none",
          }}
        >
          🎙 Join Interview Room
        </motion.button>
      </motion.div>
    </div>
  );
}

// ─── Main Interview Room ──────────────────────────────────────────────────────

function InterviewRoom() {
  const params = useSearchParams();
  const router = useRouter();
  const { profile, updateProfile } = useUserStore();

  const role = params.get("role") ?? "software-engineer";
  const experience = params.get("experience") ?? "fresher";
  const company = params.get("company") ?? "google";
  const mode = params.get("mode") ?? "professional";
  const maleVoiceName = params.get("maleVoice") ?? "";
  const femaleVoiceName = params.get("femaleVoice") ?? "";
  const isPractice = mode === "friendly";

  const persona = COMPANY_PERSONAS[company] ?? DEFAULT_PERSONA;

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("preflight");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [encouragement, setEncouragement] = useState("");
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [fillerCount, setFillerCount] = useState(0);
  const [answerScores, setAnswerScores] = useState<number[]>([]);
  const [userId, setUserId] = useState<string>("");

  const persistSessionHistory = useCallback((session: SavedSession) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("interviewSessionHistory");
      const history = raw ? (JSON.parse(raw) as SavedSession[]) : [];
      const next = [session, ...history].slice(0, 30);
      localStorage.setItem("interviewSessionHistory", JSON.stringify(next));
    } catch {
      // keep interview flow resilient
    }
  }, []);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const encourageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const {
    isReady: analyzerReady,
    isMakingEyeContact,
    expression,
    isSlouching,
    eyeContactScore,
    postureScore,
    smilePercentage,
    getSummary: getBiometricSummary,
  } = useInterviewAnalyzer(videoRef);

  // Keep a ref for questionIndex so callbacks always see the latest value
  // without needing to be in their dependency arrays (breaks circular deps)
  const questionIndexRef = useRef(0);
  useEffect(() => {
    questionIndexRef.current = questionIndex;
  }, [questionIndex]);

  // ── User ID ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let uid = localStorage.getItem("statsUserId");
    if (!uid) {
      uid = crypto.randomUUID();
      localStorage.setItem("statsUserId", uid);
    }
    setUserId(uid);
  }, []);

  // ── On mount: init speech synthesis ───────────────────────────────────────
  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    window.speechSynthesis.onvoiceschanged = () => {};
  }, []);

  // ── Attach stream when interview phase begins ──────────────────────────────
  useEffect(() => {
    if (phase === "interview" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => null);
    }
  }, [phase]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      synthRef.current?.cancel();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (encourageIntervalRef.current) clearInterval(encourageIntervalRef.current);
    };
  }, []);

  // ── speak ──────────────────────────────────────────────────────────────────
  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!synthRef.current) return;
      synthRef.current.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.92;
      utt.pitch = 1.05;
      const voices = synthRef.current.getVoices();
      const interviewerGender =
        COMPANY_PERSONAS[company]?.gender ?? persona.gender;
      const chosenName =
        interviewerGender === "female" ? femaleVoiceName : maleVoiceName;
      const preferred =
        (chosenName && voices.find((v) => v.name === chosenName)) ||
        voices.find(
          (v) =>
            v.name.includes("Google") ||
            v.name.includes("Daniel") ||
            v.name.includes("Samantha")
        );
      if (preferred) utt.voice = preferred;
      utt.onstart = () => setIsSpeaking(true);
      utt.onend = () => {
        setIsSpeaking(false);
        onEnd?.();
      };
      synthRef.current.speak(utt);
    },
    [company, persona.gender, maleVoiceName, femaleVoiceName]
  );

  // ── startListening ─────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const win = window as unknown as Window & {
      SpeechRecognition?: typeof SpeechRecognition;
      webkitSpeechRecognition?: typeof SpeechRecognition;
    };
    const SpeechRec = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let finalText = "";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript + " ";
        } else {
          interim = e.results[i][0].transcript;
        }
      }
      setTranscript(finalText);
      setInterimTranscript(interim);
      const fillers =
        (finalText + interim).match(
          /\b(um|uh|like|you know|basically|literally|actually|so|well)\b/gi
        ) ?? [];
      setFillerCount(fillers.length);
      setTimeout(() => {
        if (transcriptScrollRef.current) {
          transcriptScrollRef.current.scrollTop =
            transcriptScrollRef.current.scrollHeight;
        }
      }, 0);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, []);

  // ── stopListening ──────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ── startCamera ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => null);
      }
    } catch {
      // ignore — camera may already be acquired from preflight
    }
  }, []);

  // ── finishInterview ────────────────────────────────────────────────────────
  // Defined before getNextQuestion and submitAnswer so they can reference it
  const incrementMockCounter = useCallback(async () => {
    const uid = profile?.uid;
    if (!uid) return;
    try {
      await updateDoc(doc(db, "users", uid), {
        totalMocksAttended: increment(1),
      });
      updateProfile({
        totalMocksAttended: (profile?.totalMocksAttended ?? 0) + 1,
      });
    } catch {
      // keep interview flow resilient
    }
  }, [profile, updateProfile]);

  const finishInterview = useCallback(
    async (history: Msg[]) => {
      setIsThinking(true);
      synthRef.current?.cancel();
      try {
        const biometric = getBiometricSummary();
        const avgEyeContact = biometric.eyeContactScore;

        const res = await fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "evaluate",
            company,
            role,
            experience,
            mode,
            messages: history,
            userId: userId || undefined,
            eyeContact: avgEyeContact,
          }),
        });
        const evaluation = await res.json();
        const results = {
          ...evaluation,
          eyeContact: avgEyeContact,
          postureScore: biometric.postureScore,
          smilePercentage: biometric.smilePercentage,
          fillerWords: fillerCount,
          company,
          role,
          experience,
          mode,
          answerScores,
          transcript: history,
        };
        localStorage.setItem("interviewResults", JSON.stringify(results));
        persistSessionHistory({
          timestamp: Date.now(),
          company,
          role,
          experience,
          mode,
          finalScore: Number(evaluation?.overallScore ?? evaluation?.finalScore ?? 0),
          eyeContact: avgEyeContact,
          postureScore: biometric.postureScore,
          smilePercentage: biometric.smilePercentage,
          fillerWords: fillerCount,
          answerScores,
          transcript: history,
        });
        await incrementMockCounter();
        setPhase("complete");
        router.push("/interview/results");
      } catch {
        await incrementMockCounter();
        router.push("/interview/results");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      company, role, experience, mode,
      fillerCount,
      answerScores, userId, router, incrementMockCounter, persistSessionHistory,
      getBiometricSummary,
    ]
  );

  // ── getNextQuestion ────────────────────────────────────────────────────────
  const getNextQuestion = useCallback(
    async (history: Msg[]) => {
      setIsThinking(true);
      const currentIdx = questionIndexRef.current;
      const nextIdx = currentIdx + 1;

      try {
        const res = await fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "next",
            company,
            role,
            experience,
            mode,
            messages: history,
            questionIndex: currentIdx,
          }),
        });
        const data = await res.json();

        if (data.done) {
          await finishInterview(history);
          return;
        }

        const q = data.question ?? "Tell me more about yourself.";
        setCurrentQuestion(q);
        setQuestionIndex(nextIdx);
        setMessages([...history, { role: "assistant", content: q }]);
        setIsThinking(false);
        setPhase("interview");
        speak(q, () => startListening());
      } catch {
        await finishInterview(history);
      }
    },
    [company, role, experience, mode, speak, startListening, finishInterview]
  );

  // ── startInterview ─────────────────────────────────────────────────────────
  const startInterview = useCallback(async () => {
    setIsThinking(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", company, role, experience, mode }),
      });
      const data = await res.json();
      const q = data.question ?? "Tell me about yourself.";
      setCurrentQuestion(q);
      setMessages([{ role: "assistant", content: q }]);
      setIsThinking(false);
      speak(q, () => startListening());
    } catch {
      const q = "Tell me about yourself and your background.";
      setCurrentQuestion(q);
      setMessages([{ role: "assistant", content: q }]);
      setIsThinking(false);
      speak(q, () => startListening());
    }
  }, [company, role, experience, mode, speak, startListening]);

  // ── submitAnswer ───────────────────────────────────────────────────────────
  const submitAnswer = useCallback(async () => {
    if (!(transcript + interimTranscript).trim()) return;
    stopListening();
    const answer = (transcript + " " + interimTranscript).trim();
    setTranscript("");
    setInterimTranscript("");
    const updated: Msg[] = [...messages, { role: "user", content: answer }];
    setMessages(updated);

    if (isPractice) {
      setIsThinking(true);
      if (userId) {
        fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "stats_increment",
            userId,
            type: "practice",
          }),
        }).catch(() => null);
      }
      try {
        const res = await fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "feedback",
            company,
            question: currentQuestion,
            answer,
          }),
        });
        const fb: FeedbackData = await res.json();
        setFeedbackData(fb);
        setAnswerScores((s) => [...s, fb.score ?? 70]);
        setPhase("practice-feedback");
      } catch {
        setFeedbackData({
          idealAnswer: "Great answer! Keep using specific examples.",
          corrections: [],
          score: 75,
          tip: "Keep it up!",
        });
        setPhase("practice-feedback");
        setIsThinking(false);
      }
    } else {
      await getNextQuestion(updated);
    }
  }, [
    transcript, interimTranscript, messages, currentQuestion,
    company, isPractice, userId, stopListening, getNextQuestion,
  ]);

  // ── continueAfterFeedback ──────────────────────────────────────────────────
  const continueAfterFeedback = useCallback(async () => {
    setFeedbackData(null);
    setIsThinking(false);
    await getNextQuestion(messages);
  }, [messages, getNextQuestion]);

  // ── toggleMic ──────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        // Toggle the track
        audioTrack.enabled = !audioTrack.enabled;
        
        // CRITICAL FIX: Sync React state with actual track state
        const newMicState = audioTrack.enabled;
        setIsMicOn(newMicState);
        
        // Handle listening state based on actual mic state
        if (!newMicState) {
          stopListening();
        } else if (phase === "interview") {
          startListening();
        }
      }
    }
  }, [phase, stopListening, startListening]);

  // ── toggleCam ──────────────────────────────────────────────────────────────
  const toggleCam = useCallback(async () => {
    if (isCamOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCamOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => null);
        }
        setIsCamOn(true);
      } catch {
        // stay off
      }
    }
  }, [isCamOn]);

  // ── endCall ────────────────────────────────────────────────────────────────
  const endCall = useCallback(async () => {
    synthRef.current?.cancel();
    stopListening();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (encourageIntervalRef.current) clearInterval(encourageIntervalRef.current);
    const biometric = getBiometricSummary();
    const fallbackResults = {
      scores: {
        overall: 60,
        fluency: 60,
        grammar: 60,
        vocabulary: 60,
        clarity: 60,
        confidence: 60,
        leadership: 55,
        positivity: 65,
      },
      summary: "Session ended early. Keep practicing to improve consistency.",
      strengths: ["You participated and attempted responses."],
      improvements: ["Complete full sessions for better analytics."],
      starFeedback: "",
      grammarNote: "",
      eyeContact: biometric.eyeContactScore,
      postureScore: biometric.postureScore,
      smilePercentage: biometric.smilePercentage,
      fillerWords: fillerCount,
      company,
      role,
      experience,
      mode,
      answerScores,
      transcript: messages,
    };
    localStorage.setItem("interviewResults", JSON.stringify(fallbackResults));
    persistSessionHistory({
      timestamp: Date.now(),
      company,
      role,
      experience,
      mode,
      finalScore: fallbackResults.scores.overall,
      eyeContact: biometric.eyeContactScore,
      postureScore: biometric.postureScore,
      smilePercentage: biometric.smilePercentage,
      fillerWords: fillerCount,
      answerScores,
      transcript: messages,
    });
    await incrementMockCounter();
    router.push("/interview/results");
  }, [stopListening, router, fillerCount, company, role, experience, mode, answerScores, messages, incrementMockCounter, persistSessionHistory, getBiometricSummary]);

  // ── handleJoin ─────────────────────────────────────────────────────────────
  const handleJoin = useCallback(async () => {
    setPhase("interview");
    await startCamera();
    if (!isPractice) {
      encourageIntervalRef.current = setInterval(() => {
        setEncouragement(
          ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
        );
        setTimeout(() => setEncouragement(""), 5000);
      }, 45000);
    }
    await startInterview();
  }, [startCamera, isPractice, startInterview]);

  // ─── Render: preflight ─────────────────────────────────────────────────────
  if (phase === "preflight") {
    return (
      <PreflightScreen company={company} persona={persona} onReady={handleJoin} />
    );
  }

  // ─── Render: interview ─────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-50 dark:bg-[#0a0a0f] text-slate-900 dark:text-white transition-colors duration-300 flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-100 dark:bg-[#111118] border-b border-slate-300 dark:border-white/10 shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-semibold text-slate-700 dark:text-white/80 capitalize">
            {company} Mock Interview
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/50 capitalize">
            {mode} mode
          </span>
          {isPractice && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
              📚 Practice Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-white/40">
          <span>Q {questionIndex + 1} / 5</span>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-1.5 rounded-full"
                style={{
                  background:
                    i < questionIndex
                      ? persona.color
                      : i === questionIndex
                      ? `${persona.color}88`
                      : "rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">

        {/* LEFT: AI Interviewer */}
        <div
          className="flex-1 rounded-2xl relative overflow-hidden"
          style={{
            background: `linear-gradient(145deg, ${persona.bg}, #0a0a0f)`,
            border: `1px solid ${persona.color}25`,
          }}
        >
          <PhotoAvatar
            persona={persona}
            isSpeaking={isSpeaking}
            isThinking={isThinking}
            company={company}
          />

          {/* Question bubble */}
          <div className="absolute inset-x-4 top-4 z-30 text-center">
            <AnimatePresence mode="wait">
              {currentQuestion && !isThinking && (
                <motion.div
                  key={currentQuestion}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="inline-block px-5 py-4 rounded-2xl text-sm leading-relaxed text-white/90 backdrop-blur-sm"
                  style={{
                    background: `${persona.color}22`,
                    border: `1px solid ${persona.color}50`,
                  }}
                >
                  {currentQuestion}
                </motion.div>
              )}
              {isThinking && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="inline-flex gap-1.5 items-center text-sm text-white/50 px-4 py-2 rounded-full backdrop-blur-sm bg-black/30"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Thinking…</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Encouragement toast */}
          <AnimatePresence>
            {encouragement && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-14 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium bg-black/60 backdrop-blur border border-white/20 whitespace-nowrap z-30"
              >
                {encouragement}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: User camera */}
        <div className="w-[38%] flex flex-col gap-3 min-w-0">

          {/* Webcam */}
          <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 aspect-video flex-shrink-0">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
              style={{ opacity: isCamOn ? 1 : 0 }}
            />

            {!isCamOn && (
              <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm flex-col gap-2">
                <VideoOff className="w-8 h-8" />
                <span>Camera off</span>
              </div>
            )}

            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur text-xs">
              <Eye className="w-3 h-3 text-blue-400" />
              <span
                className={
                  eyeContactScore > 75
                    ? "text-green-400"
                    : eyeContactScore > 55
                    ? "text-yellow-400"
                    : "text-red-400"
                }
              >
                {eyeContactScore}%
              </span>
            </div>

            {fillerCount > 0 && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur text-xs">
                <span className="text-yellow-400">Fillers: {fillerCount}</span>
              </div>
            )}

            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur text-xs">
              {isListening ? (
                <>
                  <Mic className="w-3 h-3 text-red-400 animate-pulse" />
                  <span className="text-red-400">Recording</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3 h-3 text-white/30" />
                  <span className="text-white/30">Mic off</span>
                </>
              )}
            </div>
          </div>

          {/* Real-time biometric analyzer overlay */}
          <div className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white/80 space-y-1.5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <span>🎯 Eye Contact</span>
              <span className={isMakingEyeContact ? "text-green-400" : "text-yellow-400"}>
                {isMakingEyeContact ? "Good" : "Adjust gaze"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>🙂 Expression</span>
              <span className={expression === "smiling" ? "text-emerald-400" : "text-slate-300"}>
                {expression === "smiling" ? "Smiling" : "Serious"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>🪑 Posture</span>
              <span className={isSlouching ? "text-amber-400" : "text-green-400"}>
                {isSlouching ? "Sit up straight" : "Upright"}
              </span>
            </div>
            <div className="pt-1 border-t border-white/10 text-[10px] text-white/60">
              {analyzerReady ? `Smile ${smilePercentage}% • Posture ${postureScore}%` : "Initializing analyzer..."}
            </div>
          </div>
        </div>
      </div>

      {/* Live transcript bottom overlay */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-black/80 text-white p-4 rounded-xl z-50 text-center backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xs text-white/70 font-medium tracking-wide">Live Transcript</span>
          {isListening && (
            <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              REC
            </span>
          )}
          {(transcript + interimTranscript).trim() && (
            <span className="text-[10px] text-white/50 tabular-nums">
              {(transcript + interimTranscript).trim().split(/\s+/).filter(Boolean).length} words
            </span>
          )}
        </div>
        <div
          ref={transcriptScrollRef}
          className="max-h-28 overflow-y-auto leading-relaxed text-sm"
          style={{ scrollBehavior: "smooth" }}
        >
          {!(transcript + interimTranscript).trim() ? (
            <span className="text-white/40 italic text-xs">
              {isListening ? "Listening… start speaking" : "Start speaking — your words will appear here…"}
            </span>
          ) : (
            <p className="text-white/90">
              {transcript
                .split(/(\b(?:um|uh|like|you know|basically|literally|actually|so|well)\b)/gi)
                .map((chunk, idx) =>
                  /^(um|uh|like|you know|basically|literally|actually|so|well)$/i.test(chunk) ? (
                    <mark key={idx} className="bg-amber-500/25 text-amber-300 rounded px-0.5 not-italic">
                      {chunk}
                    </mark>
                  ) : (
                    <span key={idx}>{chunk}</span>
                  )
                )}
              {interimTranscript && <span className="text-white/40 italic"> {interimTranscript}</span>}
            </p>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="px-5 py-3 bg-[#111118] border-t border-white/10 flex items-center justify-between shrink-0">
        <div className="flex gap-3">
          <button
            onClick={toggleMic}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
            style={{
              background: isMicOn
                ? "rgba(255,255,255,0.08)"
                : "rgba(239,68,68,0.25)",
              border: `1px solid ${
                isMicOn
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(239,68,68,0.4)"
              }`,
            }}
          >
            {isMicOn ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5 text-red-400" />
            )}
          </button>
          <button
            onClick={toggleCam}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
            style={{
              background: isCamOn
                ? "rgba(255,255,255,0.08)"
                : "rgba(239,68,68,0.25)",
              border: `1px solid ${
                isCamOn
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(239,68,68,0.4)"
              }`,
            }}
          >
            {isCamOn ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5 text-red-400" />
            )}
          </button>
        </div>

        <motion.button
          whileHover={
            (transcript + interimTranscript).trim() ? { scale: 1.04 } : {}
          }
          whileTap={
            (transcript + interimTranscript).trim() ? { scale: 0.97 } : {}
          }
          onClick={submitAnswer}
          disabled={
            !(transcript + interimTranscript).trim() || isThinking
          }
          className="flex items-center gap-2 px-7 py-3 rounded-full font-semibold text-sm transition-all"
          style={{
            background:
              (transcript + interimTranscript).trim() && !isThinking
                ? `linear-gradient(135deg, ${persona.color}, ${persona.color}88)`
                : "rgba(255,255,255,0.06)",
            color:
              (transcript + interimTranscript).trim() && !isThinking
                ? "#fff"
                : "rgba(255,255,255,0.25)",
            cursor:
              (transcript + interimTranscript).trim() && !isThinking
                ? "pointer"
                : "not-allowed",
            boxShadow:
              (transcript + interimTranscript).trim() && !isThinking
                ? `0 0 30px ${persona.color}44`
                : "none",
          }}
        >
          {isThinking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {isThinking ? "Processing…" : "Submit Answer"}
        </motion.button>

        <button
          onClick={endCall}
          className="w-11 h-11 rounded-full bg-red-600/80 hover:bg-red-600 flex items-center justify-center transition-all border border-red-500/50"
        >
          <PhoneOff className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Practice feedback overlay */}
      <AnimatePresence>
        {phase === "practice-feedback" && feedbackData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-2xl rounded-3xl p-8 space-y-6"
              style={{
                background: "#0e0e1a",
                border: `1px solid ${persona.color}40`,
              }}
            >
              <div className="flex items-center justify-between">
                <h3
                  className="text-xl font-bold"
                  style={{ color: persona.color }}
                >
                  📚 Practice Feedback
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">Answer Score:</span>
                  <span
                    className="text-2xl font-black"
                    style={{
                      color:
                        feedbackData.score >= 75
                          ? "#34d399"
                          : feedbackData.score >= 55
                          ? "#fbbf24"
                          : "#f87171",
                    }}
                  >
                    {feedbackData.score}
                  </span>
                  <span className="text-white/30 text-sm">/100</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-400" /> Ideal
                  Answer
                </p>
                <p className="text-sm text-white/80 leading-relaxed bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3">
                  {feedbackData.idealAnswer}
                </p>
              </div>

              {feedbackData.corrections?.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-yellow-400" /> Grammar
                    / Vocabulary Corrections
                  </p>
                  <ul className="space-y-1.5">
                    {feedbackData.corrections.map((c, i) => (
                      <li
                        key={i}
                        className="text-sm text-yellow-300/80 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {feedbackData.tip && (
                <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-3">
                  <Smile className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-300/80">{feedbackData.tip}</p>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={continueAfterFeedback}
                className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${persona.color}, ${persona.color}88)`,
                  boxShadow: `0 0 30px ${persona.color}44`,
                }}
              >
                Next Question <ChevronRight className="w-4 h-4" />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-gray-50 dark:bg-[#050012] flex items-center justify-center text-slate-900 dark:text-white transition-colors duration-300">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      }
    >
      <InterviewRoom />
    </Suspense>
  );
}
