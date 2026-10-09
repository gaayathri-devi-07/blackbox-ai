"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { StarField } from "@/components/star-field";
import { useUserStore } from "@/lib/userStore";
import ResumeUploader from "@/components/ui/ResumeUploader";

const ROLES = [
  { id: "software-engineer", label: "Software Engineer", icon: "💻" },
  { id: "product-manager", label: "Product Manager", icon: "📱" },
  { id: "data-scientist", label: "Data Scientist", icon: "📊" },
  { id: "ux-designer", label: "UX/UI Designer", icon: "🎨" },
  { id: "business-analyst", label: "Business Analyst", icon: "📈" },
  { id: "marketing-manager", label: "Marketing Manager", icon: "📣" },
  { id: "hr-manager", label: "HR Manager", icon: "👥" },
  { id: "finance-analyst", label: "Finance Analyst", icon: "💰" },
  { id: "operations-manager", label: "Operations Manager", icon: "⚙️" },
  { id: "sales-executive", label: "Sales Executive", icon: "🤝" },
];

const EXPERIENCE_LEVELS = [
  { id: "fresher", label: "Fresher", desc: "0 years · Entry level", icon: "🌱" },
  { id: "junior", label: "Junior", desc: "1-2 years", icon: "🌿" },
  { id: "mid", label: "Mid-Level", desc: "3-5 years", icon: "🌳" },
  { id: "senior", label: "Senior", desc: "5-8 years", icon: "🏆" },
  { id: "lead", label: "Lead / Manager", desc: "8+ years", icon: "👑" },
];

const COMPANIES = [
  {
    id: "amazon", label: "Amazon", color: "#FF9900",
    desc: "Leadership Principles & Behavioral Depth",
    style: "Ownership, STAR answers, Customer Obsession",
    interviewer: "Alex Rivera", badge: "LP",
  },
  {
    id: "google", label: "Google", color: "#4285F4",
    desc: "Structured Thinking & Clarity",
    style: "Logical storytelling, problem approach, calm confidence",
    interviewer: "Sam Chen", badge: "G",
  },
  {
    id: "deloitte", label: "Deloitte", color: "#86BC25",
    desc: "Professional Presence & Client Mindset",
    style: "Business maturity, polished body language, consulting scenarios",
    interviewer: "Jordan Smith", badge: "D",
  },
  {
    id: "microsoft", label: "Microsoft", color: "#00A4EF",
    desc: "Collaboration & Growth Mindset",
    style: "Teamwork, adaptability, learning attitude, emotional intelligence",
    interviewer: "Casey Zhang", badge: "M",
  },
  {
    id: "apple", label: "Apple", color: "#ffffff",
    desc: "Authenticity & Passion",
    style: "Genuine personality, storytelling, personal motivation",
    interviewer: "Morgan Lee", badge: "A",
  },
  {
    id: "tcs", label: "TCS", color: "#0073CF",
    desc: "Fundamentals & Professionalism",
    style: "Clear intro, strengths/weaknesses, respectful communication",
    interviewer: "Priya Sharma", badge: "T",
  },
  {
    id: "accenture", label: "Accenture", color: "#A100FF",
    desc: "Communication & Presentation Skills",
    style: "Confidence, structured speaking, leadership discussions",
    interviewer: "Taylor Kim", badge: "Ac",
  },
];

const MODES = [
  { id: "friendly", label: "Friendly", icon: "😊", color: "#34d399", desc: "Relaxed & encouraging atmosphere" },
  { id: "professional", label: "Professional", icon: "💼", color: "#60a5fa", desc: "Standard corporate interview tone" },
  { id: "stress", label: "Stress Mode", icon: "🔥", color: "#f87171", desc: "Rapid-fire, challenging questions" },
];

// ── Voice gender heuristics ────────────────────────────────────────────────
const FEMALE_NAMES = ["zira","hazel","susan","karen","samantha","victoria","moira","fiona","tessa","eva","linda","amy","salli","kimberly","kendra","ivy","nicole","aria","jenny","ana","natasha","emma","sophie","laura","alice","allison","joanna","female","woman","girl","neerja","heera","lekha","raveena","aditi","veena","trinoids","milena","damayanti","luciana","heloise","ines","mathieu","amelie","celine","chantal","audrey","juliette","florence","charlotte","leah","nora","katja","hanna","petra","dorothy","alice","anna","elsa","ingrid","maja","tiril","zosia","paulina","ewa","lena","marisol","paloma","monica","lucia","esperanza","delia","soledad","conchita","encarnacion"];
const MALE_NAMES   = ["david","mark","daniel","james","ryan","george","richard","rishi","arthur","guy","tom","alex","fred","bruce","oliver","jorge","carlos","juan","stefan","hans","dieter","male","man","guy","enrique","pablo","rodrigo","diego","henrik","sven","petter","jakub","jan","krzysztof","andrei","dmitry","rauf","luca","matteo","giovanni","thomas","aaron","lee","li","zhang","henrik","kai","niamh","talos","noel","kabir","hemant","udaan"];

function suggestGender(voiceName: string): "male" | "female" | "neutral" {
  const lower = voiceName.toLowerCase();
  if (FEMALE_NAMES.some(n => lower.includes(n))) return "female";
  if (MALE_NAMES.some(n => lower.includes(n)))   return "male";
  return "neutral";
}

export default function InterviewSetup() {
  const router = useRouter();
  const { profile } = useUserStore();
  const [step, setStep] = useState(0); // Start at 0 for resume upload
  const [resumeUploaded, setResumeUploaded] = useState(false);
  // Remove role selection - fetch from profile
  const role = profile?.careerPath || "software-dev";
  const [experience, setExperience] = useState("");
  const [company, setCompany] = useState("");
  const [mode, setMode] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [maleVoice, setMaleVoice] = useState("");
  const [femaleVoice, setFemaleVoice] = useState("");
  const [voiceTab, setVoiceTab] = useState<"male" | "female">("male");
  const [testingVoice, setTestingVoice] = useState("");

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

  // Load all browser TTS voices
  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis?.getVoices() ?? [];
      if (v.length > 0) setVoices(v);
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  const testVoice = useCallback((name: string) => {
    const voice = voices.find(v => v.name === name);
    if (!voice) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(
      "Hello! I'm your interviewer today. Let's get started."
    );
    utt.voice = voice;
    utt.rate = 0.92;
    utt.pitch = 1.05;
    utt.onstart = () => setTestingVoice(name);
    utt.onend   = () => setTestingVoice("");
    window.speechSynthesis.speak(utt);
  }, [voices]);

  const canProceed = [
    resumeUploaded, // Step 0: Resume
    !!experience,   // Step 1: Experience
    !!company && !!mode, // Step 2: Company & Mode
    !!maleVoice && !!femaleVoice, // Step 3: Voices
  ][step];

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else {
      const params = new URLSearchParams({ role, experience, company, mode, maleVoice, femaleVoice });
      router.push(`/interview/session?${params}`);
    }
  };

  const handleResumeComplete = (resumeText: string) => {
    setResumeUploaded(true);
    setStep(1); // Move to next step
  };

  const handleResumeSkip = () => {
    setResumeUploaded(true);
    setStep(1); // Move to next step
  };

  const selectedCompany = COMPANIES.find((c) => c.id === company);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#020010] text-slate-900 dark:text-white transition-colors duration-300">
      <StarField starCount={180} />
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-900/15 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-900/15 blur-[100px]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <p className="text-xs tracking-[0.4em] text-purple-400/70 uppercase mb-2">
            Step {step + 1} of 4 · Mock Interview Setup
          </p>
          <h1 className="text-4xl font-extrabold tracking-widest bg-gradient-to-r from-purple-300 via-blue-200 to-pink-300 bg-clip-text text-transparent">
            {["Upload Resume", "Select Experience Level", "Pick Company & Mode", "Choose Interviewer Voices"][step]}
          </h1>
        </motion.div>

        {/* Step progress */}
        <div className="flex gap-2 mb-8">
          {[0, 1, 2, 3].map((s) => (
            <div
              key={s}
              className="h-1 w-20 rounded-full transition-all duration-500"
              style={{ background: s <= step ? "linear-gradient(90deg,#7c3aed,#2563eb)" : "rgba(255,255,255,0.1)" }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Resume Upload */}
          {step === 0 && (
            <motion.div
              key="s0"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-3xl"
            >
              <ResumeUploader onComplete={handleResumeComplete} onSkip={handleResumeSkip} />
            </motion.div>
          )}

          {/* Step 1: Experience Level */}
          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-xl"
            >
              <div className="flex flex-col gap-3">
                {EXPERIENCE_LEVELS.map((e) => (
                  <motion.button
                    key={e.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setExperience(e.id)}
                    className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                    style={{
                      background: experience === e.id ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.05)",
                      border: `1.5px solid ${experience === e.id ? "#2563eb" : "rgba(255,255,255,0.1)"}`,
                      boxShadow: experience === e.id ? "0 0 20px rgba(37,99,235,0.3)" : "none",
                    }}
                  >
                    <span className="text-3xl">{e.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{e.label}</p>
                      <p className="text-xs text-slate-500 dark:text-white/50">{e.desc}</p>
                    </div>
                    {experience === e.id && <span className="text-green-400 text-xl">✓</span>}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Company & Mode */}
          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-4xl"
            >
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-white/60 mb-3 tracking-wider">CHOOSE A COMPANY</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {COMPANIES.map((c) => (
                      <motion.button
                        key={c.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setCompany(c.id)}
                        className="flex flex-col gap-2 p-4 rounded-2xl text-left transition-all"
                        style={{
                          background: company === c.id ? `${c.color}15` : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${company === c.id ? c.color + "88" : "rgba(255,255,255,0.08)"}`,
                          boxShadow: company === c.id ? `0 0 20px ${c.color}30` : "none",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-900 dark:text-white">{c.label}</p>
                          {company === c.id && <span className="text-green-400 text-xl">✓</span>}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-white/50">{c.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
                {selectedCompany && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-4 py-3 rounded-2xl text-sm"
                    style={{
                      background: `${selectedCompany.color}12`,
                      border: `1px solid ${selectedCompany.color}40`,
                    }}
                  >
                    <span style={{ color: selectedCompany.color }}>{selectedCompany.label} Style:</span>
                    <span className="text-slate-700 dark:text-white/70 ml-2">{selectedCompany.style}</span>
                  </motion.div>
                )}

                <div>
                  <p className="text-sm text-white/60 mb-3 tracking-wider">CHOOSE INTERVIEW MODE</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {MODES.map((m) => (
                      <motion.button
                        key={m.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setMode(m.id)}
                        className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl transition-all text-center"
                        style={{
                          background: mode === m.id ? `${m.color}20` : "rgba(255,255,255,0.05)",
                          border: `1.5px solid ${mode === m.id ? m.color : "rgba(255,255,255,0.1)"}`,
                          boxShadow: mode === m.id ? `0 0 24px ${m.color}40` : "none",
                        }}
                      >
                        <span className="text-3xl">{m.icon}</span>
                        <span className="font-bold text-sm" style={{ color: mode === m.id ? m.color : "currentColor" }}>{m.label}</span>
                        <span className="text-[10px] text-slate-500 dark:text-white/50">{m.desc}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Voice Selection */}
          {step === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-4xl"
            >
              {/* Tab switcher */}
              <div className="flex gap-2 justify-center mb-6">
                {(["male", "female"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setVoiceTab(tab)}
                    className="flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all"
                    style={{
                      background: voiceTab === tab
                        ? tab === "male" ? "rgba(59,130,246,0.3)" : "rgba(236,72,153,0.3)"
                        : "rgba(255,255,255,0.07)",
                      border: `1.5px solid ${voiceTab === tab
                        ? tab === "male" ? "#3b82f6" : "#ec4899"
                        : "rgba(255,255,255,0.1)"}`,
                      color: voiceTab === tab
                        ? tab === "male" ? "#93c5fd" : "#f9a8d4"
                        : "rgba(255,255,255,0.5)",
                      boxShadow: voiceTab === tab
                        ? `0 0 20px ${tab === "male" ? "#3b82f655" : "#ec489955"}`
                        : "none",
                    }}
                  >
                    {tab === "male" ? "👨" : "👩"}
                    {tab === "male" ? " Male Interviewer" : " Female Interviewer"}
                    {(tab === "male" ? maleVoice : femaleVoice) && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: tab === "male" ? "#3b82f640" : "#ec489940" }}>
                        ✓ Set
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Selected voice display */}
              {(voiceTab === "male" ? maleVoice : femaleVoice) && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 px-4 py-2 rounded-xl text-sm text-center"
                  style={{
                    background: voiceTab === "male" ? "rgba(59,130,246,0.12)" : "rgba(236,72,153,0.12)",
                    border: `1px solid ${voiceTab === "male" ? "#3b82f640" : "#ec489940"}`,
                  }}
                >
                  <span style={{ color: voiceTab === "male" ? "#93c5fd" : "#f9a8d4" }}>
                    ✓ Selected:
                  </span>
                  <span className="ml-2 text-white/80 font-semibold">
                    {voiceTab === "male" ? maleVoice : femaleVoice}
                  </span>
                </motion.div>
              )}

              {voices.length === 0 ? (
                <div className="text-center text-slate-500 dark:text-white/40 py-12">
                  <p className="text-4xl mb-3">🔊</p>
                  <p>Loading voices… make sure your browser supports Web Speech API.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "#7c3aed40 transparent" }}
                >
                  {voices.map((v) => {
                    const suggested = suggestGender(v.name);
                    const isSelected = voiceTab === "male"
                      ? maleVoice === v.name
                      : femaleVoice === v.name;
                    const accentColor = voiceTab === "male" ? "#3b82f6" : "#ec4899";
                    const isTesting   = testingVoice === v.name;

                    return (
                      <motion.div
                        key={v.name}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() =>
                          voiceTab === "male"
                            ? setMaleVoice(v.name)
                            : setFemaleVoice(v.name)
                        }
                        className="relative flex flex-col gap-1 p-3 rounded-xl cursor-pointer transition-all"
                        style={{
                          background: isSelected ? `${accentColor}20` : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${isSelected ? accentColor : "rgba(255,255,255,0.08)"}`,
                          boxShadow: isSelected ? `0 0 16px ${accentColor}35` : "none",
                        }}
                      >
                        {/* Suggested badge */}
                        {suggested === voiceTab && (
                          <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: `${accentColor}30`, color: accentColor }}>
                            ★ Suggested
                          </span>
                        )}

                        <p className="text-sm font-semibold text-white/90 pr-16 leading-tight">{v.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-white/40">{v.lang} · {v.localService ? "Local" : "Network"}</p>

                        <div className="flex items-center gap-2 mt-1">
                          {/* Test button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); testVoice(v.name); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                            style={{
                              background: isTesting ? `${accentColor}40` : "rgba(255,255,255,0.08)",
                              color: isTesting ? accentColor : "rgba(255,255,255,0.6)",
                              border: `1px solid ${isTesting ? accentColor : "rgba(255,255,255,0.1)"}`,
                            }}
                          >
                            {isTesting ? "▶ Playing…" : "🔊 Test"}
                          </button>

                          {isSelected && (
                            <span className="text-[10px] font-bold" style={{ color: accentColor }}>✓ Selected</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Both-selected summary */}
              {maleVoice && femaleVoice && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 flex gap-4 justify-center flex-wrap"
                >
                  <div className="px-4 py-2 rounded-xl text-xs" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid #3b82f640" }}>
                    <span className="text-blue-400">👨 Male:</span>
                    <span className="ml-2 text-white/80">{maleVoice}</span>
                  </div>
                  <div className="px-4 py-2 rounded-xl text-xs" style={{ background: "rgba(236,72,153,0.12)", border: "1px solid #ec489940" }}>
                    <span className="text-pink-400">👩 Female:</span>
                    <span className="ml-2 text-white/80">{femaleVoice}</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-4 mt-8 items-center"
        >
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 rounded-full text-sm border border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10 transition"
            >
              ← Back
            </button>
          )}
          <motion.button
            whileHover={canProceed ? { scale: 1.05 } : {}}
            whileTap={canProceed ? { scale: 0.97 } : {}}
            onClick={handleNext}
            disabled={!canProceed}
            className="px-10 py-3 rounded-full text-sm font-bold tracking-widest uppercase transition-all"
            style={{
              background: canProceed ? "linear-gradient(135deg,#7c3aed,#2563eb)" : "rgba(255,255,255,0.08)",
              color: canProceed ? "#fff" : "rgba(100,116,139,0.7)",
              cursor: canProceed ? "pointer" : "not-allowed",
              boxShadow: canProceed ? "0 0 30px rgba(124,58,237,0.4)" : "none",
            }}
          >
            {step < 3 ? "Next →" : step === 3 ? "Next →" : "🎙 Enter Interview Room"}
          </motion.button>
        </motion.div>

        <p className="mt-6 text-slate-500 dark:text-white/30 text-sm">
          or{" "}
          <button
            onClick={() => router.push("/interview/gd")}
            className="text-purple-400 hover:text-purple-300 underline transition"
          >
            Join Group Discussion Simulator
          </button>
        </p>
      </div>
    </div>
  );
}
