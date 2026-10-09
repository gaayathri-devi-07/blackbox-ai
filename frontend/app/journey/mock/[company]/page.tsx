"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import { useCompanion, companionColor, companionEmoji } from "@/components/use-companion";
import { StarField } from "@/components/star-field";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CompanionTip {
  text: string;
  type: "posture" | "eye" | "confidence" | "smile" | "speed";
}

const COMPANY_META: Record<string, { name: string; color: string; logo: string; interviewer: string; gender: "male" | "female" }> = {
  google: { name: "Google", color: "#4285F4", logo: "🔵", interviewer: "Alex Chen", gender: "male" },
  amazon: { name: "Amazon", color: "#FF9900", logo: "🟠", interviewer: "Sarah Kim", gender: "female" },
  microsoft: { name: "Microsoft", color: "#00A4EF", logo: "🪟", interviewer: "James Wright", gender: "male" },
  meta: { name: "Meta", color: "#0668E1", logo: "🔷", interviewer: "Priya Sharma", gender: "female" },
  startup: { name: "Startup", color: "#a78bfa", logo: "🚀", interviewer: "Max Lee", gender: "male" },
};

const COMPANION_TIPS: CompanionTip[] = [
  { text: "Make eye contact with the camera! 👀", type: "eye" },
  { text: "Sit up straight — great posture = confidence!", type: "posture" },
  { text: "Smile! It makes you seem approachable 😊", type: "smile" },
  { text: "Speak slowly and clearly. You've got this!", type: "confidence" },
  { text: "You're doing amazing! Keep going 🌟", type: "confidence" },
  { text: "Take a breath before answering. It's okay!", type: "confidence" },
  { text: "Use the STAR format for behavioral questions!", type: "confidence" },
  { text: "Pause to think — it shows thoughtfulness, not weakness.", type: "speed" },
];

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function MockInterviewRoom() {
  const router = useRouter();
  const params = useParams();
  const company = (params?.company as string) ?? "startup";
  const meta = COMPANY_META[company] ?? COMPANY_META.startup;

  const companion = useCompanion();
  const color = companion ? companionColor(companion.id) : "#a78bfa";
  const emoji = companion ? companionEmoji(companion.id) : "⭐";

  const [phase, setPhase] = useState<"intro" | "interview" | "ending">("intro");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [micSupported, setMicSupported] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [companionTip, setCompanionTip] = useState<string>("");
  const [showCompanionTip, setShowCompanionTip] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interviewer] = useState<"male" | "female">(meta.gender);

  const videoRef = useRef<HTMLVideoElement>(null);           // user webcam
  const interviewerVideoRef = useRef<HTMLVideoElement>(null); // interviewer MP4
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
    return () => synthRef.current?.cancel();
  }, []);

  // Imperatively swap video source and force play whenever speaking state changes.
  // Do NOT use key= on the <video> — that unmounts the element and breaks the ref.
  useEffect(() => {
    const vid = interviewerVideoRef.current;
    if (!vid) return;
    const src = isSpeaking
      ? interviewer === "male" ? "/mentalk.mp4" : "/womentalk.mp4"
      : interviewer === "male" ? "/menblink.mp4" : "/womenblink.mp4";
    vid.src = src;
    vid.load();
    vid.play().catch(() => {/* browser autoplay policy — silently ignore */});
  }, [isSpeaking, interviewer]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!synthRef.current) { onEnd?.(); return; }
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => { setIsSpeaking(false); onEnd?.(); };
    utt.onerror = () => { setIsSpeaking(false); onEnd?.(); };
    synthRef.current.speak(utt);
  }, []);

  useEffect(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setMicSupported(!!SR);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentQuestion]);

  // Attach stream to video element once it is rendered
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn]);

  // Camera + mic setup
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch {
      // fallback: video only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraOn(true);
      } catch {
        console.warn("Camera not available");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    recognitionRef.current?.stop();
    setIsRecording(false);
    setCameraOn(false);
  }, []);

  // Companion tip cycle
  const showTip = useCallback(() => {
    const tip = COMPANION_TIPS[Math.floor(Math.random() * COMPANION_TIPS.length)];
    setCompanionTip(tip.text);
    setShowCompanionTip(true);
    tipTimerRef.current = setTimeout(() => {
      setShowCompanionTip(false);
      tipTimerRef.current = setTimeout(showTip, 20000 + Math.random() * 15000);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    };
  }, [stopCamera]);

  // Start interview
  const startInterview = useCallback(async () => {
    setPhase("interview");
    setIsLoading(true);
    await startCamera();

    // Start timer
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    // Start companion tips after 10s
    tipTimerRef.current = setTimeout(showTip, 10000);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", company }),
      });
      const data = await res.json();
      setCurrentQuestion(data.question);
      setQuestionIndex(0);
      setMessages([{ role: "assistant", content: data.question }]);
      speak(data.question);
    } catch {
      const fallback = "Tell me about yourself and why you're interested in this role.";
      setCurrentQuestion(fallback);
      setMessages([{ role: "assistant", content: fallback }]);
      speak(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [company, startCamera, showTip, speak]);

  // Send answer
  const sendAnswer = useCallback(async (answer: string) => {
    if (!answer.trim() || isLoading) return;
    setIsRecording(false);
    setTranscript("");
    setTextInput("");

    const userMsg: Message = { role: "user", content: answer };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "next",
          company,
          messages: newMessages,
          questionIndex,
        }),
      });
      const data = await res.json();

      if (data.done) {
        setPhase("ending");
        stopCamera();
        if (timerRef.current) clearInterval(timerRef.current);
        if (tipTimerRef.current) clearTimeout(tipTimerRef.current);

        // Store conversation for results
        if (typeof window !== "undefined") {
          localStorage.setItem("interviewData", JSON.stringify({
            company,
            messages: newMessages,
            duration,
          }));
        }
        return;
      }

      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setMessages((prev) => [...prev, { role: "assistant", content: data.question }]);
      speak(data.question);
    } catch {
      const fallback = "Could you elaborate on that?";
      setMessages((prev) => [...prev, { role: "assistant", content: fallback }]);
      speak(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [messages, questionIndex, company, isLoading, duration, stopCamera, speak]);

  // Voice recording
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      setTranscript(t);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
  }, []);

  const stopRecordingAndSend = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    if (transcript.trim()) sendAnswer(transcript);
  }, [transcript, sendAnswer]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ── INTRO SCREEN ────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#020010] text-slate-900 dark:text-white transition-colors duration-300">
        <StarField starCount={200} />
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-900/15 blur-[120px]" />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center max-w-lg mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-6xl mb-4 block">{meta.logo}</span>
            <h1 className="text-3xl font-extrabold mb-2" style={{ color: meta.color }}>{meta.name} Interview</h1>
            <p className="text-slate-600 dark:text-white/50 text-sm mb-8">5 questions · AI interviewer · Live coaching</p>

            <div
              className="rounded-2xl p-5 mb-6 text-left"
              style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}33` }}
            >
              <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-widest mb-3">Before You Begin</p>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-white/70">
                <li className="flex items-center gap-2">📷 Camera access will be requested</li>
                <li className="flex items-center gap-2">🎤 Answer by voice or type</li>
                <li className="flex items-center gap-2">🌟 Your companion will coach you live</li>
                <li className="flex items-center gap-2">📊 Full performance report at the end</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button onClick={() => router.push("/journey/mock")} className="flex-1 py-3 rounded-2xl text-sm text-slate-600 dark:text-white/40 border border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/30 transition-all">
                ← Back
              </button>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={startInterview}
                className="flex-2 px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-wide"
                style={{ background: `linear-gradient(135deg, ${meta.color}, #7c3aed)`, boxShadow: `0 0 30px ${meta.color}44` }}
              >
                Start Interview 🚀
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── ENDING SCREEN ───────────────────────────────────────────────────────
  if (phase === "ending") {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#020010] text-slate-900 dark:text-white transition-colors duration-300">
        <StarField starCount={200} />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring" }}>
            <span className="text-6xl mb-4 block">🎉</span>
            <h1 className="text-3xl font-extrabold mb-2 text-slate-900 dark:text-white">Interview Complete!</h1>
            <p className="text-slate-600 dark:text-white/50 mb-4">Duration: {formatTime(duration)}</p>
            <p className="text-sm text-slate-500 dark:text-white/40 mb-8">Your AI is evaluating your performance...</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/journey/mock/results")}
              className="px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-widest"
              style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 0 40px rgba(124,58,237,0.5)" }}
            >
              📊 View My Results →
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── INTERVIEW ROOM ──────────────────────────────────────────────────────
  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#010008] text-slate-900 dark:text-white transition-colors duration-300">
      <StarField starCount={120} />

      {/* Top bar */}
      <div
        className="relative z-20 flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(1,0,8,0.8)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{meta.logo}</span>
          <div>
            <p className="text-xs font-bold" style={{ color: meta.color }}>{meta.name} Interview</p>
            <p className="text-[10px] text-slate-500 dark:text-white/35">with {meta.interviewer} (AI)</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs font-mono text-red-300">{formatTime(duration)}</span>
          </div>
          {/* Question progress */}
          <div className="flex gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all"
                style={{ background: i <= questionIndex ? meta.color : "rgba(255,255,255,0.15)" }}
              />
            ))}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-white/40">Q {questionIndex + 1} / 5</span>
          {/* End Call button */}
          <button
            onClick={() => {
              stopCamera();
              if (timerRef.current) clearInterval(timerRef.current);
              if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
              if (typeof window !== "undefined") {
                localStorage.setItem("interviewData", JSON.stringify({ company, messages, duration }));
              }
              setPhase("ending");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all hover:opacity-90 active:scale-95"
            style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.5)", color: "#fca5a5" }}
          >
            <span>📵</span> End Call
          </button>
        </div>
      </div>

      {/* Main interview area */}
      <div className="relative z-10 flex h-[calc(100vh-56px)]">

        {/* Left: AI Interviewer */}
        <div
          className="w-[38%] flex flex-col items-center justify-center p-6"
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* AI Interviewer — MP4 video face */}
          <div className="relative mb-5">
            {/* Glow ring when speaking */}
            {isSpeaking && (
              <motion.div
                className="absolute -inset-3 rounded-3xl pointer-events-none"
                style={{ boxShadow: `0 0 40px 12px ${meta.color}55`, border: `1px solid ${meta.color}44` }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}

            {/* Video container */}
            <div
              style={{
                width: 220,
                height: 260,
                borderRadius: 24,
                overflow: "hidden",
                position: "relative",
                border: `2px solid ${isSpeaking ? meta.color : meta.color + "66"}`,
                boxShadow: `0 0 ${isSpeaking ? "40px" : "16px"} ${meta.color}44`,
                background: "#0d0d0d",
              }}
            >
              <video
                ref={interviewerVideoRef}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />

              {/* Thinking dots while loading */}
              {isLoading && !isSpeaking && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[0, 0.15, 0.3].map((d, i) => (
                      <motion.div key={i}
                        style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color }}
                        animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.7, repeat: Infinity, delay: d }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Speaking badge */}
              {isSpeaking && (
                <motion.div
                  style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", background: meta.color, color: "#fff", borderRadius: 20, padding: "3px 14px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", boxShadow: `0 0 12px ${meta.color}88` }}
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  🔊 Speaking...
                </motion.div>
              )}
            </div>
          </div>

          <p className="text-sm font-bold mb-0.5" style={{ color: meta.color }}>{meta.interviewer}</p>
          <p className="text-[11px] text-slate-500 dark:text-white/40 mb-5">{meta.name} AI Interviewer</p>

          {/* Current question */}
          <div
            className="w-full rounded-2xl p-4 text-sm leading-relaxed"
            style={{
              background: `${meta.color}15`,
              border: `1px solid ${meta.color}33`,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {isLoading && !currentQuestion ? (
              <div className="flex gap-1.5 justify-center py-2">
                {[0, 0.15, 0.3].map((d) => (
                  <motion.div key={d} className="w-2 h-2 rounded-full" style={{ background: meta.color }}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: d }} />
                ))}
              </div>
            ) : currentQuestion}
          </div>
        </div>

        {/* Center: User webcam + chat */}
        <div className="flex-1 flex flex-col">
          {/* Webcam feed — video always in DOM so videoRef is always available */}
          <div
            className="relative flex-shrink-0 m-4 rounded-2xl overflow-hidden"
            style={{ height: 220, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
              style={{ display: cameraOn ? "block" : "none" }}
            />
            {!cameraOn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-4xl block mb-2">👤</span>
                  <p className="text-xs text-slate-500 dark:text-white/30">Camera off</p>
                </div>
              </div>
            )}
            {/* Live indicator */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[10px] text-slate-100 dark:text-white/80">You</span>
            </div>
          </div>

          {/* Chat scroll */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {messages.slice(-6).map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                  style={
                    msg.role === "user"
                      ? { background: `${color}33`, border: `1px solid ${color}44`, color: "rgba(255,255,255,0.88)" }
                      : { background: `${meta.color}18`, border: `1px solid ${meta.color}33`, color: "rgba(255,255,255,0.75)" }
                  }
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="px-4 pb-4 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {isRecording && (
              <div className="mb-2 px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-white/60 min-h-[40px]"
                style={{ background: `${color}15`, border: `1px solid ${color}44` }}>
                {transcript || <span className="text-slate-500 dark:text-white/30 italic">Listening... speak your answer</span>}
              </div>
            )}

            <div className="flex gap-2">
              <input
                className="flex-1 bg-slate-100 dark:bg-white/[0.06] border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/25 outline-none focus:border-purple-400/50 transition-colors"
                placeholder="Type your answer..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendAnswer(textInput)}
                disabled={isLoading}
              />
              <button
                onClick={() => sendAnswer(textInput)}
                disabled={!textInput.trim() || isLoading}
                className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-30 transition-all"
                style={{ background: `${meta.color}44`, border: `1px solid ${meta.color}66`, color: meta.color }}
              >↑</button>

              {micSupported && (
                <motion.button
                  onClick={isRecording ? stopRecordingAndSend : startRecording}
                  animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  disabled={isLoading}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-base disabled:opacity-30"
                  style={{
                    background: isRecording ? `${color}66` : `${color}22`,
                    border: `1.5px solid ${isRecording ? color : color + "55"}`,
                    boxShadow: isRecording ? `0 0 16px ${color}55` : "none",
                  }}
                >{isRecording ? "⏹️" : "🎤"}</motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Companion floating overlay */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        <AnimatePresence>
          {showCompanionTip && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 6 }}
              className="rounded-2xl rounded-br-sm px-3 py-2 text-[11px] font-semibold text-center max-w-[180px]"
              style={{
                background: "rgba(5,2,20,0.92)",
                backdropFilter: "blur(20px)",
                border: `1px solid ${color}55`,
                color,
              }}
            >
              {companionTip}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl cursor-pointer"
          style={{
            background: `radial-gradient(circle, ${color}cc, ${color}44)`,
            boxShadow: `0 0 20px ${color}55`,
            border: `2px solid ${color}66`,
          }}
          onClick={() => { setCompanionTip("You can do this!! 💪 Stay confident!"); setShowCompanionTip(true); setTimeout(() => setShowCompanionTip(false), 3000); }}
        >
          {emoji}
        </motion.div>
      </div>
    </div>
  );
}
