"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/lib/userStore";
import ResumeUploader from "@/components/ui/ResumeUploader";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GDSetupData {
  career: string;
  careerLabel: string;
  careerIcon: string;
  experience: string;
  experienceLabel: string;
  maleVoiceName: string;
  femaleVoiceName: string;
  cameraEnabled: boolean;
  micEnabled: boolean;
  stream?: MediaStream;
}

interface GDSetupProps {
  prefetchedTopic?: string;
  onComplete: (data: GDSetupData) => void;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const ROLES = [
  { id: "software-engineer",   label: "Software Engineer",  icon: "💻" },
  { id: "product-manager",     label: "Product Manager",    icon: "📱" },
  { id: "data-scientist",      label: "Data Scientist",     icon: "📊" },
  { id: "ux-designer",         label: "UX/UI Designer",     icon: "🎨" },
  { id: "business-analyst",    label: "Business Analyst",   icon: "📈" },
  { id: "marketing-manager",   label: "Marketing Manager",  icon: "📣" },
  { id: "hr-manager",          label: "HR Manager",         icon: "👥" },
  { id: "finance-analyst",     label: "Finance Analyst",    icon: "💰" },
  { id: "operations-manager",  label: "Operations Manager", icon: "⚙️" },
  { id: "sales-executive",     label: "Sales Executive",    icon: "🤝" },
];

const EXPERIENCE_LEVELS = [
  { id: "fresher", label: "Fresher",       desc: "0–1 year · Entry level",  icon: "🌱", color: "#34d399" },
  { id: "junior",  label: "Junior",        desc: "1–2 years",               icon: "🌿", color: "#60a5fa" },
  { id: "mid",     label: "Mid-Level",     desc: "3–5 years",               icon: "🌳", color: "#a78bfa" },
  { id: "senior",  label: "Senior",        desc: "5–8 years",               icon: "🏆", color: "#fbbf24" },
  { id: "lead",    label: "Lead / Manager",desc: "8+ years",                icon: "👑", color: "#f472b6" },
];

const MODERATORS = [
  { key: "male" as const,   name: "Dr. Raj Mehta",  title: "Lead Moderator",   emoji: "👨‍💼", color: "#7c3aed" },
  { key: "female" as const, name: "Ms. Sarah Chen", title: "Co-Moderator",     emoji: "👩‍💼", color: "#ec4899" },
];

const AI_ATTENDEES = [
  { name: "Alex Chen", label: "Analytical", color: "#3b82f6", initials: "AC" },
  { name: "Maya Patel",label: "Practical",  color: "#10b981", initials: "MP" },
  { name: "Ryan Blake", label: "Debater",   color: "#f59e0b", initials: "RB" },
  { name: "Sam Kim",    label: "Concise",   color: "#a855f7", initials: "SK" },
];

// ─── Voice gender heuristics (same as interview setup) ────────────────────────
const FEMALE_NAMES = ["zira","hazel","susan","karen","samantha","victoria","moira","fiona","tessa","eva","linda","amy","salli","kimberly","kendra","ivy","nicole","aria","jenny","ana","natasha","emma","sophie","laura","alice","allison","joanna","female","woman","neerja","heera","lekha","raveena","aditi","veena","milena","damayanti","luciana","heloise","amelie","celine","chantal","audrey","juliette","florence","charlotte","leah","nora","katja","hanna","zosia","paulina","ewa","lena","marisol","paloma","monica","lucia","soledad","conchita","encarnacion"];
const MALE_NAMES   = ["david","mark","daniel","james","ryan","george","richard","rishi","arthur","guy","tom","alex","fred","bruce","oliver","jorge","carlos","juan","stefan","hans","dieter","male","man","enrique","pablo","rodrigo","diego","henrik","sven","petter","jakub","jan","krzysztof","andrei","dmitry","luca","matteo","giovanni","thomas","aaron","lee","li","zhang","kai","noel","kabir","hemant","udaan"];

function detectGender(voiceName: string): "male" | "female" | "neutral" {
  const lower = voiceName.toLowerCase();
  if (FEMALE_NAMES.some((n) => lower.includes(n))) return "female";
  if (MALE_NAMES.some((n) => lower.includes(n)))   return "male";
  return "neutral";
}

// ─── Progress Step Labels ─────────────────────────────────────────────────────
const STEPS = ["Resume", "Experience", "Voices", "Join GD"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function GDSetup({ prefetchedTopic, onComplete }: GDSetupProps) {
  const { profile } = useUserStore();
  const [step, setStep] = useState(0);
  const [resumeUploaded, setResumeUploaded] = useState(false);

  // Auto-fetch career from profile (remove Step 0)
  const career = profile?.careerPath || "software-engineer";
  const careerData = ROLES.find(r => r.id === career) || ROLES[0];
  const careerLabel = careerData.label;
  const careerIcon = careerData.icon;

  // Step 1 - Experience
  const [experience, setExperience]           = useState("");
  const [experienceLabel, setExperienceLabel] = useState("");

  // Step 2 - Voices
  const [voices, setVoices]               = useState<SpeechSynthesisVoice[]>([]);
  const [maleVoiceName, setMaleVoiceName] = useState("");
  const [femaleVoiceName, setFemaleVoiceName] = useState("");
  const [voiceTab, setVoiceTab]           = useState<"male" | "female">("male");
  const [testingVoice, setTestingVoice]   = useState("");

  // Step 3 - Join GD / Media
  const [cameraEnabled, setCameraEnabled]   = useState<boolean | null>(null);
  const [micEnabled, setMicEnabled]         = useState<boolean | null>(null);
  const [mediaStream, setMediaStream]       = useState<MediaStream | null>(null);
  const [requestingMedia, setRequestingMedia] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check if resume already uploaded
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const existingResume = localStorage.getItem('userResume');
      if (existingResume) {
        setResumeUploaded(true);
        setStep(1); // Skip resume step if already uploaded
      }
    }
  }, []);

  const stars = useMemo(
    () =>
      Array.from({ length: 120 }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        top: `${(i * 53) % 100}%`,
        size: i % 3 === 0 ? 2 : 1,
        opacity: 0.15 + ((i * 17) % 45) / 100,
        duration: 2 + ((i * 29) % 40) / 10,
        delay: ((i * 13) % 30) / 10,
      })),
    []
  );

  // ── Load TTS voices ───────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const load = () => {
      const v = window.speechSynthesis?.getVoices() ?? [];
      if (v.length === 0) return;
      setVoices(v);
      // Auto-select defaults if not already set
      setMaleVoiceName((prev) => prev || v.find((x) => detectGender(x.name) === "male")?.name || v[0]?.name || "");
      setFemaleVoiceName((prev) => prev || v.find((x) => detectGender(x.name) === "female")?.name || v[1]?.name || "");
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  // ── Attach camera stream to video element ─────────────────────────────────
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  // ── Cleanup stream on unmount (only if not handed off to parent) ─────────
  useEffect(() => {
    return () => {
      // Stream is passed to parent via onComplete; parent controls its lifetime.
      // Only cancel any pending TTS.
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ── Test a voice ──────────────────────────────────────────────────────────
  const testVoice = useCallback(
    (name: string) => {
      const voice = voices.find((v) => v.name === name);
      if (!voice) return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(
        "Hello! I'm your GD moderator today. Let's have a productive discussion."
      );
      utt.voice = voice;
      utt.rate = 0.92;
      utt.pitch = 1.05;
      utt.onstart = () => setTestingVoice(name);
      utt.onend   = () => setTestingVoice("");
      utt.onerror = () => setTestingVoice("");
      window.speechSynthesis.speak(utt);
    },
    [voices]
  );

  // ── Request camera + mic ───────────────────────────────────────────────────
  const requestPermissions = useCallback(async () => {
    setRequestingMedia(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      setCameraEnabled(true);
      setMicEnabled(true);
    } catch {
      // Try audio-only fallback
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMediaStream(audioStream);
        setCameraEnabled(false);
        setMicEnabled(true);
      } catch {
        setCameraEnabled(false);
        setMicEnabled(false);
      }
    }
    setRequestingMedia(false);
  }, []);

  // ── Can proceed logic ─────────────────────────────────────────────────────
  const canProceed = [
    resumeUploaded, // Step 0: Resume
    !!experience,   // Step 1: Experience
    true,           // Step 2: Voices optional
    true,           // Step 3: Cam/mic optional
  ][step];

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleResumeComplete = (resumeText: string) => {
    setResumeUploaded(true);
    setStep(1); // Move to next step
  };

  const handleResumeSkip = () => {
    setResumeUploaded(true);
    setStep(1); // Move to next step
  };

  const handleJoin = () => {
    // Pass live stream to parent (parent will stop it on unmount)
    window.speechSynthesis?.cancel();
    onComplete({
      career,
      careerLabel,
      careerIcon,
      experience,
      experienceLabel,
      maleVoiceName,
      femaleVoiceName,
      cameraEnabled: cameraEnabled ?? false,
      micEnabled: micEnabled ?? false,
      stream: mediaStream ?? undefined,
    });
  };

  // ── Filtered voice lists ──────────────────────────────────────────────────
  const maleVoices   = voices.filter((v) => detectGender(v.name) !== "female");
  const femaleVoices = voices.filter((v) => detectGender(v.name) !== "male");
  const currentTabVoices = voiceTab === "male" ? maleVoices : femaleVoices;
  const currentSelectedVoice = voiceTab === "male" ? maleVoiceName : femaleVoiceName;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen w-full overflow-y-auto overflow-x-hidden flex flex-col items-center px-4 py-8 pb-32 relative"
      style={{ background: "linear-gradient(160deg, #050010 0%, #08001a 50%, #030008 100%)" }}
    >
      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {stars.map((star) => (
          <motion.div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            }}
            animate={{ opacity: [0.1, 0.6, 0.1] }}
            transition={{ duration: star.duration, repeat: Infinity, delay: star.delay }}
          />
        ))}
        {/* Nebula blobs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl" style={{ background: "#7c3aed" }} />
        <div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full opacity-8 blur-3xl" style={{ background: "#ec4899" }} />
      </div>

      <div className="relative z-10 w-full max-w-2xl flex flex-col gap-6 pb-8">

        {/* Header */}
        <div className="text-center">
          <motion.h1
            className="text-2xl font-bold mb-1"
            style={{ background: "linear-gradient(90deg, #c4b5fd, #93c5fd, #f9a8d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Group Discussion Setup
          </motion.h1>
          <p className="text-white/40 text-sm">
            {prefetchedTopic ? `Topic: "${prefetchedTopic.slice(0, 60)}…"` : "Configuring your GD session"}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                className="h-1 w-full rounded-full"
                style={{
                  background: i <= step ? "linear-gradient(90deg, #7c3aed, #ec4899)" : "rgba(255,255,255,0.08)",
                }}
                initial={false}
                animate={{ opacity: i <= step ? 1 : 0.4 }}
              />
              <span className={`text-[10px] font-semibold ${i === step ? "text-purple-300" : "text-white/25"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Step Content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl p-6"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}
          >
            {/* ── Step 0: Resume Upload ── */}
            {step === 0 && (
              <div className="flex flex-col gap-4">
                <ResumeUploader onComplete={handleResumeComplete} onSkip={handleResumeSkip} />
              </div>
            )}

            {/* ── Step 1: Experience ── */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-white font-bold text-lg">Your experience level?</h2>
                  <p className="text-white/40 text-sm mt-0.5">This calibrates the discussion complexity</p>
                </div>
                <div className="flex flex-col gap-2">
                  {EXPERIENCE_LEVELS.map((lvl) => {
                    const selected = experience === lvl.id;
                    return (
                      <motion.button
                        key={lvl.id}
                        onClick={() => { setExperience(lvl.id); setExperienceLabel(lvl.label); }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                        style={{
                          background: selected ? `${lvl.color}18` : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${selected ? lvl.color : "rgba(255,255,255,0.08)"}`,
                          boxShadow: selected ? `0 0 20px ${lvl.color}33` : "none",
                        }}
                      >
                        <span className="text-3xl">{lvl.icon}</span>
                        <div className="flex-1">
                          <p className="font-bold text-white text-sm">{lvl.label}</p>
                          <p className="text-white/40 text-xs">{lvl.desc}</p>
                        </div>
                        <AnimatePresence>
                          {selected && (
                            <motion.div
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0 }}
                              className="w-6 h-6 rounded-full flex items-center justify-center"
                              style={{ background: lvl.color }}
                            >
                              <span className="text-white text-xs">✓</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 2: Voice Selection ── */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-white font-bold text-lg">Choose moderator voices</h2>
                  <p className="text-white/40 text-sm mt-0.5">Your interviewers will speak in these voices</p>
                </div>

                {/* Moderator tabs */}
                <div className="flex gap-2">
                  {MODERATORS.map((mod) => (
                    <button
                      key={mod.key}
                      onClick={() => setVoiceTab(mod.key)}
                      className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold"
                      style={{
                        background: voiceTab === mod.key ? `${mod.color}22` : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${voiceTab === mod.key ? mod.color : "rgba(255,255,255,0.08)"}`,
                        color: voiceTab === mod.key ? mod.color : "rgba(255,255,255,0.4)",
                      }}
                    >
                      <span>{mod.emoji}</span>
                      <div className="text-left">
                        <p className="text-xs font-bold leading-tight">{mod.name}</p>
                        <p className="text-[10px] opacity-60">{mod.title}</p>
                      </div>
                      {(voiceTab === mod.key ? currentSelectedVoice : (mod.key === "male" ? maleVoiceName : femaleVoiceName)) && (
                        <span className="ml-auto text-[10px] opacity-50">✓</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Voice list */}
                <div
                  className="flex flex-col gap-1.5 overflow-y-auto max-h-52 pr-1"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "#7c3aed33 transparent" }}
                >
                  {currentTabVoices.length === 0 ? (
                    <div className="text-center py-6 text-white/30 text-sm">
                      <p className="text-2xl mb-2">🔇</p>
                      <p>No voices detected. The browser may need a moment.</p>
                      <p className="text-xs mt-1 text-white/20">Voice will work with system default.</p>
                    </div>
                  ) : (
                    currentTabVoices.slice(0, 20).map((v) => {
                      const isSelected = currentSelectedVoice === v.name;
                      const isTesting  = testingVoice === v.name;
                      const mod = MODERATORS.find((m) => m.key === voiceTab)!;
                      return (
                        <motion.div
                          key={v.name}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer"
                          style={{
                            background: isSelected ? `${mod.color}18` : "rgba(255,255,255,0.03)",
                            border: `1px solid ${isSelected ? mod.color : "rgba(255,255,255,0.06)"}`,
                          }}
                          onClick={() => {
                            if (voiceTab === "male") setMaleVoiceName(v.name);
                            else setFemaleVoiceName(v.name);
                          }}
                          whileHover={{ scale: 1.01 }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{v.name}</p>
                            <p className="text-[10px] text-white/30">{v.lang} · {v.localService ? "Local" : "Network"}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); testVoice(v.name); }}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                            style={{
                              background: isTesting ? `${mod.color}33` : "rgba(255,255,255,0.06)",
                              color: isTesting ? mod.color : "rgba(255,255,255,0.4)",
                              border: `1px solid ${isTesting ? mod.color : "rgba(255,255,255,0.08)"}`,
                            }}
                          >
                            {isTesting ? "🔊…" : "Test"}
                          </button>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
                              style={{ background: mod.color }}
                            >
                              ✓
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>
                <p className="text-[10px] text-white/20 text-center">
                  You can skip this step — the room will use system default voices.
                </p>
              </div>
            )}

            {/* ── Step 2: Join GD ── */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-white font-bold text-lg">Ready to join?</h2>
                  <p className="text-white/40 text-sm mt-0.5">Preview the room and enable camera & mic</p>
                </div>

                {/* Room preview */}
                <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Room Participants</p>
                  {/* Interviewers */}
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] text-white/30 uppercase tracking-wide">Moderators</p>
                    <div className="flex gap-2">
                      {MODERATORS.map((mod) => (
                        <div key={mod.key} className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1"
                          style={{ background: `${mod.color}11`, border: `1px solid ${mod.color}33` }}>
                          <span className="text-xl">{mod.emoji}</span>
                          <div>
                            <p className="text-xs font-bold text-white">{mod.name}</p>
                            <p className="text-[10px]" style={{ color: `${mod.color}99` }}>{mod.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide mt-1">AI Candidates</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {AI_ATTENDEES.map((ai) => (
                        <div key={ai.name} className="flex flex-col items-center gap-1 py-2 rounded-xl"
                          style={{ background: `${ai.color}11`, border: `1px solid ${ai.color}22` }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: `linear-gradient(135deg, ${ai.color}cc, ${ai.color}55)` }}>
                            {ai.initials}
                          </div>
                          <p className="text-[10px] font-semibold text-white text-center leading-tight">{ai.name.split(" ")[0]}</p>
                          <p className="text-[9px]" style={{ color: `${ai.color}99` }}>{ai.label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide mt-1">You</p>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl"
                      style={{ background: "#06b6d411", border: "1px solid #06b6d433" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-cyan-500/30 border border-cyan-500/50">
                        👤
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{careerIcon} {careerLabel}</p>
                        <p className="text-[10px] text-white/40">{experienceLabel} · Participant</p>
                      </div>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold text-cyan-400 bg-cyan-400/10">You</span>
                    </div>
                  </div>
                </div>

                {/* Camera/Mic permission */}
                <div className="flex flex-col gap-3">
                  {cameraEnabled === null && micEnabled === null ? (
                    <motion.button
                      onClick={requestPermissions}
                      disabled={requestingMedia}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm text-white"
                      style={{
                        background: "linear-gradient(135deg, #0e7490, #0891b2)",
                        boxShadow: "0 0 20px #0891b244",
                        opacity: requestingMedia ? 0.7 : 1,
                      }}
                    >
                      {requestingMedia ? (
                        <>
                          <motion.div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white"
                            animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                          Requesting permissions…
                        </>
                      ) : (
                        <><span className="text-lg">📷</span> Enable Camera &amp; Microphone</>
                      )}
                    </motion.button>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center gap-2 py-2.5 px-3 rounded-xl"
                        style={{ background: cameraEnabled ? "#10b98122" : "#ef444422", border: `1px solid ${cameraEnabled ? "#10b981" : "#ef4444"}44` }}>
                        <span>{cameraEnabled ? "📷" : "🚫"}</span>
                        <span className="text-xs font-semibold" style={{ color: cameraEnabled ? "#34d399" : "#f87171" }}>
                          Camera {cameraEnabled ? "Ready" : "Blocked"}
                        </span>
                      </div>
                      <div className="flex-1 flex items-center gap-2 py-2.5 px-3 rounded-xl"
                        style={{ background: micEnabled ? "#10b98122" : "#ef444422", border: `1px solid ${micEnabled ? "#10b981" : "#ef4444"}44` }}>
                        <span>{micEnabled ? "🎤" : "🔇"}</span>
                        <span className="text-xs font-semibold" style={{ color: micEnabled ? "#34d399" : "#f87171" }}>
                          Mic {micEnabled ? "Ready" : "Blocked"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Video preview */}
                  {cameraEnabled && mediaStream && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="relative rounded-xl overflow-hidden" style={{ background: "#000", border: "1px solid #06b6d444" }}>
                      <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-40 object-cover" />
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full"
                        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
                        <motion.div className="w-1.5 h-1.5 rounded-full bg-red-500"
                          animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                        <span className="text-[10px] text-white font-medium">Live preview</span>
                      </div>
                    </motion.div>
                  )}

                  {(cameraEnabled === false && micEnabled === false) && (
                    <p className="text-xs text-white/30 text-center">
                      Camera &amp; mic blocked — you can still participate in text mode.
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <motion.button
              onClick={handleBack}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-5 py-3 rounded-xl font-semibold text-sm text-white/50 border border-white/10 hover:border-white/20 transition-colors"
            >
              ← Back
            </motion.button>
          )}

          <motion.button
            onClick={step < 3 ? handleNext : handleJoin}
            disabled={!canProceed}
            whileHover={canProceed ? { scale: 1.03 } : {}}
            whileTap={canProceed ? { scale: 0.97 } : {}}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: step === 2
                ? "linear-gradient(135deg, #7c3aed, #ec4899)"
                : "linear-gradient(135deg, #4c1d95, #7c3aed)",
              boxShadow: step === 2 ? "0 0 28px #7c3aed66" : "0 0 16px #7c3aed33",
            }}
          >
            {step === 2 ? "🚀 Join Group Discussion" : "Continue →"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
