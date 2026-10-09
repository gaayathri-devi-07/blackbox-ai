"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import GDLayout from "./GDLayout";
import GDSetup, { type GDSetupData } from "./GDSetup";
import { decideHandRaise } from "./HandRaiseEngine";
import type { GDParticipant } from "@/components/GDParticipantCard";
import type { GDInterviewer } from "@/components/InterviewerCard";
import { useUserStore } from "@/lib/userStore";
import { doc, increment, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = "setup" | "lobby" | "intro" | "discussing" | "ended";
  
interface Message {
  speakerId: string;
  speakerName: string;
  text: string;
  color: string;
  timestamp: number;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

const INTERVIEWERS: GDInterviewer[] = [
  {
    id: "mod1",
    name: "Ms. Sarah Chen",
    title: "Lead Moderator",
    gender: "female",
    color: "#ec4899",
    bgColor: "#2d0030",
    initials: "SC",
    isSpeaking: false,
  },
  {
    id: "mod2",
    name: "Dr. Raj Mehta",
    title: "Co-Moderator",
    gender: "male",
    color: "#7c3aed",
    bgColor: "#1a0040",
    initials: "RM",
    isSpeaking: false,
  },
];

const INITIAL_PARTICIPANTS: GDParticipant[] = [
  {
    id: "ai1",
    name: "Alex Chen",
    personalityLabel: "Analytical",
    initials: "AC",
    color: "#3b82f6",
    bgColor: "#0d1b36",
    status: "idle",
    speakingCount: 0,
    // personality used in API calls — stored separately below
  },
  {
    id: "ai2",
    name: "Maya Patel",
    personalityLabel: "Practical",
    initials: "MP",
    color: "#10b981",
    bgColor: "#062316",
    status: "idle",
    speakingCount: 0,
  },
  {
    id: "ai3",
    name: "Ryan Blake",
    personalityLabel: "Debater",
    initials: "RB",
    color: "#f59e0b",
    bgColor: "#2a1500",
    status: "idle",
    speakingCount: 0,
  },
  {
    id: "ai4",
    name: "Sam Kim",
    personalityLabel: "Concise",
    initials: "SK",
    color: "#a855f7",
    bgColor: "#1a0030",
    status: "idle",
    speakingCount: 0,
  },
];

// Personality descriptions — kept separate to avoid polluting the component type
const AI_PERSONALITIES: Record<string, string> = {
  ai1: "analytical thinker who uses data, statistics and logical frameworks. Always backs claims with evidence.",
  ai2: "practical thinker who grounds arguments in real-world examples, industry case studies, and personal experiences.",
  ai3: "confident debater who politely challenges assumptions, plays devil's advocate, and presents counterarguments.",
  ai4: "concise communicator who speaks in brief, impactful 1-2 sentence points and summarizes complex ideas simply.",
};

const AI_RAISE_PROBABILITY: Record<string, number> = {
  ai1: 0.6,
  ai2: 0.5,
  ai3: 0.7,
  ai4: 0.4,
};

const MAX_TURNS = 10;

// ─── Component ───────────────────────────────────────────────────────────────

export default function GDRoomPage() {
  const router = useRouter();
  const { profile, updateProfile } = useUserStore();

  // ── State ──────────────────────────────────────────────────────────────────
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [setupData, setSetupData] = useState<GDSetupData | null>(null);
  const [participants, setParticipants] = useState<GDParticipant[]>(INITIAL_PARTICIPANTS);
  const [interviewers, setInterviewers] = useState<GDInterviewer[]>(INTERVIEWERS);
  const [speakerQueue, setSpeakerQueue] = useState<string[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string>("none");
  const [isDiscussionActive, setIsDiscussionActive] = useState(false);
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [moderatorSpeech, setModeratorSpeech] = useState("");
  const [userHandRaised, setUserHandRaised] = useState(false);
  const [userIsSpeaking, setUserIsSpeaking] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [currentSpeakerText, setCurrentSpeakerText] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("Preparing discussion…");
  const [isFetchingTopic, setIsFetchingTopic] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // ── Refs (stable across renders, safe to read inside async functions) ──────
  const participantsRef = useRef<GDParticipant[]>(INITIAL_PARTICIPANTS);
  const transcriptRef = useRef<Message[]>([]);
  const isMountedRef = useRef(true);
  const isTTSEnabledRef = useRef(true);
  const setupDataRef = useRef<GDSetupData | null>(null);
  const turnCountRef = useRef(0);
  const endingRef = useRef(false);

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
      // non-blocking
    }
  }, [profile, updateProfile]);

  // Keep refs in sync
  useEffect(() => { participantsRef.current = participants; }, [participants]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { isTTSEnabledRef.current = isTTSEnabled; }, [isTTSEnabled]);
  useEffect(() => { setupDataRef.current = setupData; }, [setupData]);
  useEffect(() => { return () => { isMountedRef.current = false; cameraStream?.getTracks().forEach(t => t.stop()); }; }, [cameraStream]);

  // ── TTS Helper (accepts optional voice name for moderator differentiation) ──
  const speakTTS = useCallback((text: string, voiceName?: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isTTSEnabledRef.current || typeof window === "undefined" || !window.speechSynthesis) {
        setTimeout(resolve, Math.min(text.length * 45, 6000));
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      if (voiceName) {
        const voice = window.speechSynthesis.getVoices().find((v) => v.name === voiceName);
        if (voice) utterance.voice = voice;
      }
      const fallback = setTimeout(resolve, Math.min(text.length * 80 + 3000, 30000));
      utterance.onend = () => { clearTimeout(fallback); resolve(); };
      utterance.onerror = () => { clearTimeout(fallback); resolve(); };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // ── API Helpers ────────────────────────────────────────────────────────────
  const callModeratorSpeak = useCallback(
    async (
      situation: "introduce" | "select_speaker" | "encourage_silent" | "follow_up" | "wrap_up",
      extra?: { targetParticipant?: string }
    ): Promise<string> => {
      try {
        const res = await fetch("/api/gd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "moderator_speak", situation, topic, ...extra }),
        });
        const { speech } = await res.json();
        return speech || "";
      } catch {
        return "";
      }
    },
    [topic]
  );

  const callGenerateAnswer = useCallback(
    async (aiId: string, aiName: string): Promise<string> => {
      try {
        const history = transcriptRef.current.slice(-6).map((m) => ({
          speakerName: m.speakerName,
          text: m.text,
        }));
        const res = await fetch("/api/gd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate_answer",
            aiId,
            aiName,
            personality: AI_PERSONALITIES[aiId] ?? "thoughtful professional",
            topic,
            conversationHistory: history,
          }),
        });
        const { speech } = await res.json();
        return speech || "I think this topic has many dimensions worth exploring carefully.";
      } catch {
        return "I believe we should consider multiple perspectives on this issue.";
      }
    },
    [topic]
  );

  // ── Moderator speaks (audio + visual) ─────────────────────────────────────
  const moderatorSpeak = useCallback(
    async (
      situation: "introduce" | "select_speaker" | "encourage_silent" | "follow_up" | "wrap_up",
      extra?: { targetParticipant?: string },
      moderatorIndex = 0
    ): Promise<void> => {
      if (!isMountedRef.current) return;
      const speech = await callModeratorSpeak(situation, extra);
      if (!speech || !isMountedRef.current) return;

      // mod1 (index 0) = female lead → femaleVoiceName; mod2 (index 1) = male co → maleVoiceName
      const sd = setupDataRef.current;
      const voiceName = moderatorIndex === 0 ? sd?.femaleVoiceName : sd?.maleVoiceName;

      setModeratorSpeech(speech);
      setInterviewers((prev) =>
        prev.map((iv, i) => ({ ...iv, isSpeaking: i === moderatorIndex }))
      );
      await speakTTS(speech, voiceName);
      if (!isMountedRef.current) return;
      setInterviewers((prev) => prev.map((iv) => ({ ...iv, isSpeaking: false })));
    },
    [callModeratorSpeak, speakTTS]
  );

  const addToQueue = useCallback((speakerId: string, prioritize = false) => {
    if (!speakerId || speakerId === "none") return;
    setSpeakerQueue((prev) => {
      if (speakerId === currentSpeaker && !prioritize) return prev;
      const without = prev.filter((id) => id !== speakerId);
      if (prioritize) return [speakerId, ...without];
      if (without.includes(speakerId)) return without;
      return prioritize ? [speakerId, ...prev] : [...prev, speakerId];
    });
  }, [currentSpeaker]);

  const forceUserOverride = useCallback(() => {
    const interruptedSpeaker = currentSpeaker;
    if (interruptedSpeaker && interruptedSpeaker !== "none" && interruptedSpeaker !== "user" && interruptedSpeaker !== "moderator") {
      addToQueue(interruptedSpeaker, true);
    }

    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }

    setParticipants((prev) =>
      prev.map((p) => (p.status === "speaking" ? { ...p, status: "hand-raised" } : p))
    );
    setInterviewers((prev) => prev.map((iv) => ({ ...iv, isSpeaking: false })));
    setCurrentSpeakerText({});
    setModeratorSpeech("");
    setCurrentSpeaker("user");
    setUserIsSpeaking(true);
    setUserHandRaised(true);
    setStatusMessage("🎤 Override: Your turn now.");
  }, [currentSpeaker, addToQueue]);

  const completeSpeakerTurn = useCallback(() => {
    setCurrentSpeaker("none");
  }, []);

  const finalizeDiscussion = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setCurrentSpeaker("moderator");
    setStatusMessage("Moderator is wrapping up…");
    await moderatorSpeak("wrap_up");
    if (!isMountedRef.current) return;
    await incrementMockCounter();
    setPhase("ended");
    setIsDiscussionActive(false);
    setStatusMessage("Group discussion complete!");
  }, [moderatorSpeak, incrementMockCounter]);

  // ── Trigger hand-raise decisions for all AIs ───────────────────────────────
  const triggerHandRaises = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return;
    const current = participantsRef.current;

    const previousSpeakers = transcriptRef.current.slice(-4).map((m) => ({
      name: m.speakerName,
      snippet: m.text.slice(0, 80),
    }));

    // Parallel decisions for all AIs not currently speaking
    const decisions = await Promise.all(
      current
        .filter((ai) => currentSpeaker !== ai.id)
        .map(async (ai) => {
          const raise = await decideHandRaise(
            {
              aiId: ai.id,
              aiName: ai.name,
              personality: AI_PERSONALITIES[ai.id] ?? "",
              question: topic,
              previousSpeakers,
              speakingCount: ai.speakingCount,
            },
            AI_RAISE_PROBABILITY[ai.id] ?? 0.5
          );
          return { id: ai.id, raise };
        })
    );

    for (const { id, raise } of decisions) {
      if (!isMountedRef.current) return;
      if (raise) {
        addToQueue(id);
        setParticipants((prev) =>
          prev.map((p) => (p.id === id && p.status === "idle" ? { ...p, status: "hand-raised" } : p))
        );
      }
    }
  }, [topic, currentSpeaker, addToQueue]);

  // ── Process one AI speaker turn ────────────────────────────────────────────
  const processAISpeaker = useCallback(
    async (aiId: string): Promise<void> => {
      if (!isMountedRef.current) return;
      const ai = participantsRef.current.find((p) => p.id === aiId);
      if (!ai) return;

      // Mark speaking
      setParticipants((prev) =>
        prev.map((p) => (p.id === aiId ? { ...p, status: "speaking" } : p))
      );
      setCurrentSpeaker(aiId);
      setStatusMessage(`${ai.name} is speaking…`);

      // Moderator invites speaker (alternate between moderators)
      await moderatorSpeak("select_speaker", { targetParticipant: ai.name }, turnCountRef.current % 2);

      // Generate AI answer
      const speech = await callGenerateAnswer(aiId, ai.name);
      if (!isMountedRef.current) return;

      // Add to transcript + show text on card
      const msg: Message = {
        speakerId: aiId,
        speakerName: ai.name,
        text: speech,
        color: ai.color,
        timestamp: Date.now(),
      };
      transcriptRef.current = [...transcriptRef.current, msg];
      setTranscript([...transcriptRef.current]);
      setCurrentSpeakerText((prev) => ({ ...prev, [aiId]: speech }));

      // TTS
      await speakTTS(speech);
      if (!isMountedRef.current) return;

      // Mark idle
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === aiId ? { ...p, status: "idle", speakingCount: p.speakingCount + 1 } : p
        )
      );
      setCurrentSpeakerText((prev) => {
        const next = { ...prev };
        delete next[aiId];
        return next;
      });
      completeSpeakerTurn();
    },
    [callGenerateAnswer, moderatorSpeak, speakTTS, completeSpeakerTurn]
  );

  const handleUserDoneSpeaking = useCallback(() => {
    const msg: Message = {
      speakerId: "user",
      speakerName: "You",
      text: "Shared verbal response in discussion turn.",
      color: "#06b6d4",
      timestamp: Date.now(),
    };
    transcriptRef.current = [...transcriptRef.current, msg];
    setTranscript([...transcriptRef.current]);
    setUserIsSpeaking(false);
    setUserHandRaised(false);
    setStatusMessage("Thank you for your contribution.");
    turnCountRef.current++;
    if (turnCountRef.current >= MAX_TURNS) {
      void finalizeDiscussion();
      return;
    }
    completeSpeakerTurn();
    }, [completeSpeakerTurn, finalizeDiscussion]);

  // ── Icebreaker: randomly pick an AI to speak if silence lasts 5s ──────────────
  const triggerIcebreaker = useCallback(() => {
    const current = participantsRef.current;
    const aiCandidates = current.filter((p) => p.status === "idle");
    if (!aiCandidates.length) return;
    const randomAI = aiCandidates[Math.floor(Math.random() * aiCandidates.length)];
    addToQueue(randomAI.id);
    setParticipants((prev) =>
      prev.map((p) => (p.id === randomAI.id ? { ...p, status: "hand-raised" } : p))
    );
  }, [addToQueue]);

  // ── Silence timer: if currentSpeaker is "none" for 5s, trigger icebreaker ─────
  useEffect(() => {
    if (!isDiscussionActive || phase !== "discussing" || currentSpeaker !== "none") return;
    const timer = setTimeout(() => {
      if (currentSpeaker === "none" && isDiscussionActive && phase === "discussing") {
        triggerIcebreaker();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isDiscussionActive, phase, currentSpeaker, triggerIcebreaker]);

  // ── Prefetch topic as soon as page loads (ready by the time setup completes) ─
  useEffect(() => {
    const fetchTopic = async () => {
      setIsFetchingTopic(true);
      try {
        const res = await fetch("/api/gd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_topic" }),
        });
        const { topic: t } = await res.json();
        if (t) setTopic(t);
      } catch {
        setTopic("Is Artificial Intelligence a threat or an opportunity for the future workforce?");
      } finally {
        setIsFetchingTopic(false);
      }
    };
    fetchTopic();
  }, []);

  // ── Setup complete → store data + start discussion ─────────────────────────
  const handleSetupComplete = useCallback(
    (data: GDSetupData) => {
      setSetupData(data);
      setupDataRef.current = data;
      if (data.stream) setCameraStream(data.stream);
      // Brief lobby phase shows "Joining…" before discussion starts
      setPhase("lobby");
    },
    []
  );

  // ── Start discussion ───────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (!topic || isFetchingTopic) return;
    setPhase("intro");
    setIsDiscussionActive(true);
    setParticipants(INITIAL_PARTICIPANTS);
    setTranscript([]);
    transcriptRef.current = [];
    turnCountRef.current = 0;
    setSpeakerQueue([]);
    setCurrentSpeaker("moderator");
    endingRef.current = false;
    setStatusMessage("Moderator is introducing the topic…");
    setUserHandRaised(false);
    setUserIsSpeaking(false);
    setCurrentSpeakerText({});

  }, [topic, isFetchingTopic]);

  // Start discussion with moderator as first strict speaker.
  useEffect(() => {
    if (!isDiscussionActive || phase !== "intro" || currentSpeaker !== "moderator") return;
    let cancelled = false;

    const startWithModerator = async () => {
      await moderatorSpeak("introduce");
      if (!isMountedRef.current || cancelled) return;
      const openFloorMessage = "Now, I'd like to open the floor for discussion. Anyone can share their thoughts on this topic. Who would like to start?";
      setModeratorSpeech(openFloorMessage);
      setInterviewers((prev) => prev.map((iv, i) => ({ ...iv, isSpeaking: i === 0 })));
      const sd = setupDataRef.current;
      await speakTTS(openFloorMessage, sd?.femaleVoiceName);
      if (!isMountedRef.current || cancelled) return;
      setInterviewers((prev) => prev.map((iv) => ({ ...iv, isSpeaking: false })));
      setPhase("discussing");
      setStatusMessage("Participants are deciding whether to speak…");
      await triggerHandRaises();
      if (!isMountedRef.current || cancelled) return;
      completeSpeakerTurn();
    };

    startWithModerator();
    return () => { cancelled = true; };
  }, [isDiscussionActive, phase, currentSpeaker, moderatorSpeak, speakTTS, triggerHandRaises, completeSpeakerTurn]);

  // Queue orchestrator: whenever no one is speaking, pick next queued speaker.
  useEffect(() => {
    if (!isDiscussionActive || phase !== "discussing" || currentSpeaker !== "none") return;
    if (turnCountRef.current >= MAX_TURNS) return;

    let cancelled = false;
    if (!speakerQueue.length) {
      const current = participantsRef.current;
      const silent = current.find((p) => p.speakingCount === 0 && p.status === "idle");
      if (silent) {
        addToQueue(silent.id);
        setParticipants((prev) =>
          prev.map((p) => (p.id === silent.id ? { ...p, status: "hand-raised" } : p))
        );
      } else if (turnCountRef.current < MAX_TURNS - 1) {
        const keepFlowing = async () => {
          setCurrentSpeaker("moderator");
          setStatusMessage("Moderator is asking a follow-up question…");
          await moderatorSpeak("follow_up");
          if (cancelled || !isMountedRef.current) return;
          completeSpeakerTurn();
          await triggerHandRaises();
        };
        keepFlowing();
      } else {
        void finalizeDiscussion();
      }
      return;
    }

    const next = speakerQueue[0];
    setSpeakerQueue((prev) => prev.slice(1));
    setCurrentSpeaker(next);
    if (next === "user") {
      setUserIsSpeaking(true);
      setStatusMessage("Your turn to speak! Click 'Done Speaking' when finished.");
      return;
    }

    const runAI = async () => {
      await processAISpeaker(next);
      if (cancelled || !isMountedRef.current) return;
      await triggerHandRaises();
      if (cancelled || !isMountedRef.current) return;
      turnCountRef.current++;
      if (turnCountRef.current >= MAX_TURNS) {
        await finalizeDiscussion();
      }
    };

    runAI();
    return () => { cancelled = true; };
  }, [isDiscussionActive, phase, currentSpeaker, speakerQueue, addToQueue, processAISpeaker, triggerHandRaises, completeSpeakerTurn, finalizeDiscussion]);

  // ── User raises hand ───────────────────────────────────────────────────────
  const handleUserHandRaise = useCallback(() => {
    if (!isDiscussionActive) return;
    forceUserOverride();
  }, [isDiscussionActive, forceUserOverride]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #050010 0%, #0a0020 50%, #030008 100%)" }}
    >
      {/* Header — hidden during setup (GDSetup has its own full-screen layout) */}
      {phase !== "setup" && (
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-white/40 hover:text-white/80 transition-colors text-sm"
          >
            ← Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          <h1 className="text-white font-bold text-lg">Group Discussion Room</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Phase indicator */}
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{
                background: phase === "discussing" ? "#10b981" : phase === "ended" ? "#ef4444" : "#6b7280",
              }}
              animate={phase === "discussing" ? { opacity: [1, 0.4, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-xs text-white/40 font-medium capitalize">{phase}</span>
          </div>

          {phase === "discussing" && (
            <div className="text-xs text-white/30">
              Turn {Math.min(turnCountRef.current, MAX_TURNS)}/{MAX_TURNS}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Status bar — only during discussion */}
      {phase !== "setup" && (
      <AnimatePresence mode="wait">
        <motion.div
          key={statusMessage}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="px-6 py-2 text-center text-xs font-medium text-white/40 border-b border-white/5"
        >
          {statusMessage}
        </motion.div>
      </AnimatePresence>
      )}

      {/* ── Setup wizard overlay ── */}
      {phase === "setup" && (
        <div className="fixed inset-0 z-50">
          <GDSetup
            prefetchedTopic={topic}
            onComplete={handleSetupComplete}
          />
        </div>
      )}

      {/* ── Lobby: "Joining…" transition screen ── */}
      <AnimatePresence>
        {phase === "lobby" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 px-6"
            onAnimationComplete={() => {
              // Auto-start the discussion after the lobby entrance animation
              setTimeout(() => handleStart(), 800);
            }}
          >
            <motion.div
              className="flex flex-col items-center gap-4"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="text-6xl">🎤</div>
              <h2 className="text-2xl font-bold text-white">Joining the room…</h2>
              <p className="text-white/40 text-sm text-center max-w-sm">
                Setting up your discussion with {setupData?.careerIcon} {setupData?.careerLabel} context
              </p>
            </motion.div>

            {/* Topic pill */}
            {topic && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="px-5 py-3 rounded-2xl text-center max-w-md"
                style={{ background: "#0d0020", border: "1.5px solid #7c3aed44" }}
              >
                <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest mb-1">Today&apos;s Topic</p>
                <p className="text-white text-sm font-semibold leading-snug">{topic}</p>
              </motion.div>
            )}

            {/* Loading dots */}
            <div className="flex gap-2">
              {[0, 0.15, 0.3].map((d, i) => (
                <motion.div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-purple-500"
                  animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: d }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main grid always rendered (never blank) ── */}
      <div className="flex-1 overflow-auto px-4 py-4">
        <GDLayout
          interviewers={interviewers}
          participants={participants}
          topic={topic}
          phase={phase === "ended" ? "ended" : "discussing"}
          moderatorSpeech={moderatorSpeech}
          handQueue={speakerQueue}
          userHandRaised={userHandRaised}
          userIsSpeaking={userIsSpeaking}
          currentSpeakerText={currentSpeakerText}
          currentSpeaker={currentSpeaker}
          isDiscussionActive={isDiscussionActive}
          onUserHandRaise={handleUserHandRaise}
          onUserDoneSpeaking={handleUserDoneSpeaking}
          transcript={transcript}
          isTTSEnabled={isTTSEnabled}
          userStream={cameraStream}
          onToggleTTS={() => {
            if (isTTSEnabled && typeof window !== "undefined") window.speechSynthesis?.cancel();
            setIsTTSEnabled((v) => !v);
          }}
        />
      </div>

      {/* ── Ended overlay ── */}
      <AnimatePresence>
        {phase === "ended" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-end justify-center pb-12 pointer-events-none"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="pointer-events-auto flex flex-col items-center gap-4 px-8 py-6 rounded-3xl"
              style={{ background: "#0d001f", border: "1.5px solid #7c3aed55", boxShadow: "0 0 40px #7c3aed33" }}
            >
              <div className="text-4xl">🏆</div>
              <h3 className="text-white font-bold text-xl">Discussion Complete!</h3>
              <p className="text-white/50 text-sm text-center max-w-sm">
                Great session! You participated in {transcript.filter((m) => m.speakerId === "user").length} turns out of {transcript.length} total.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPhase("setup");
                    setSetupData(null);
                    setupDataRef.current = null;
                    setParticipants(INITIAL_PARTICIPANTS);
                    setTranscript([]);
                    setSpeakerQueue([]);
                    setCurrentSpeaker("none");
                    setIsDiscussionActive(false);
                    setModeratorSpeech("");
                    setUserHandRaised(false);
                    endingRef.current = false;
                    // Prefetch a new topic in background
                    fetch("/api/gd", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "get_topic" }),
                    })
                      .then((r) => r.json())
                      .then(({ topic: t }) => { if (t) setTopic(t); })
                      .catch(() => {});
                  }}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4c1d95)" }}
                >
                  🔄 New Discussion
                </button>
                <button
                  onClick={() => router.push("/interview/results")}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white/60 border border-white/10"
                >
                  View Results →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
