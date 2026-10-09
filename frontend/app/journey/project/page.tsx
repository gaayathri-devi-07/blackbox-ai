"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { CosmicLayout, FloatingCompanion, useCompanion, companionColor, companionEmoji } from "@/components/use-companion";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isVoice?: boolean;
}

interface Question {
  id: number;
  question: string;
}

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function ProjectAI() {
  const router = useRouter();
  const companion = useCompanion();
  const color = companion ? companionColor(companion.id) : "#a78bfa";
  const emoji = companion ? companionEmoji(companion.id) : "⭐";

  const [phase, setPhase] = useState<"input" | "questions" | "chat">("input");
  const [projectText, setProjectText] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [micSupported, setMicSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const decodePdfString = (value: string) => {
    return value
      .replace(/\\([nrtbf()\\])/g, (_match, code: string) => {
        const map: Record<string, string> = {
          n: "\n",
          r: "\r",
          t: "\t",
          b: "\b",
          f: "\f",
          "(": "(",
          ")": ")",
          "\\": "\\",
        };
        return map[code] ?? code;
      })
      .replace(/\\(\d{3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
  };

  const extractPdfText = (buffer: ArrayBuffer) => {
    try {
      const uint8Array = new Uint8Array(buffer);
      const decoder = new TextDecoder("utf-8", { fatal: false });
      let text = decoder.decode(uint8Array);
      
      // Try multiple extraction strategies
      const chunks: string[] = [];
      
      // Strategy 1: Extract text between BT...ET blocks (BeginText...EndText)
      const btRegex = /BT\s+(.*?)\s+ET/gs;
      let btMatch;
      while ((btMatch = btRegex.exec(text)) !== null) {
        chunks.push(btMatch[1]);
      }
      
      // Strategy 2: Extract text from Tj commands
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(text)) !== null) {
        const decoded = decodePdfString(tjMatch[1]);
        if (decoded.trim()) chunks.push(decoded);
      }
      
      // Strategy 3: Extract text from TJ array commands
      const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
      let tjArrayMatch;
      while ((tjArrayMatch = tjArrayRegex.exec(text)) !== null) {
        const items = tjArrayMatch[1].match(/\(([^)]*)\)/g);
        if (items) {
          items.forEach(item => {
            const decoded = decodePdfString(item.slice(1, -1));
            if (decoded.trim()) chunks.push(decoded);
          });
        }
      }
      
      if (chunks.length > 0) {
        return chunks.join(" ").replace(/\s+/g, " ").trim();
      }
      
      // Fallback: Extract all readable text
      return text
        .replace(/[\x00-\x1F\x7F-\x9F]/g, " ") // Remove control characters
        .replace(/[^\x20-\x7E\s]/g, "") // Keep only printable ASCII + spaces
        .replace(/\s+/g, " ")
        .trim();
    } catch (error) {
      console.error("PDF extraction error:", error);
      throw new Error("Could not extract text from PDF");
    }
  };

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.onload = () => {
        try {
          if (file.type === "application/pdf") {
            const buffer = reader.result as ArrayBuffer;
            resolve(extractPdfText(buffer));
          } else {
            resolve(String(reader.result ?? ""));
          }
        } catch (error) {
          reject(error);
        }
      };
      if (file.type === "application/pdf") reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
    });

  const handleProjectFile = async (file: File) => {
    setExtracting(true);
    setUploadError("");
    try {
      const text = (await readFileAsText(file)).trim();
      if (!text) {
        setProjectText("");
        setUploadedFileName("");
        setUploadError("We couldn't extract text from this file. Please upload a text-based .txt, .md, or .pdf file.");
        return;
      }
      setProjectText(text);
      setUploadedFileName(file.name);
    } catch {
      setProjectText("");
      setUploadedFileName("");
      setUploadError("File upload failed. Please try again.");
    } finally {
      setExtracting(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleProjectFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleProjectFile(file);
    e.target.value = "";
  };

  useEffect(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setMicSupported(!!SR);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const analyzeProject = async () => {
    if (!projectText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", projectDescription: projectText }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      
      const data = await res.json();
      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions generated");
      }
      
      setQuestions(data.questions);
      setPhase("questions");
    } catch (error: any) {
      console.error("Project analysis error:", error);
      alert(`Failed to analyze project: ${error.message || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  };

  const startQuestion = (q: Question) => {
    setActiveQuestion(q);
    setMessages([{
      role: "assistant",
      content: `Great! Here's your question:\n\n**${q.question}**\n\nAnswer via voice 🎤 or type your response below. I'll give you detailed feedback!`,
    }]);
    setPhase("chat");
  };

  const sendAnswer = useCallback(async (answer: string, isVoice = false) => {
    if (!answer.trim() || !activeQuestion) return;
    const userMsg: ChatMessage = { role: "user", content: answer, isVoice };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setTextInput("");
    setTranscript("");
    setLoading(true);

    try {
      const res = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          projectDescription: projectText,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          companionId: companion?.id,
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      
      const data = await res.json();
      if (!data.message) {
        throw new Error("No response from AI");
      }
      
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch (error: any) {
      console.error("Answer evaluation error:", error);
      setMessages((prev) => [...prev, { 
        role: "assistant", 
        content: `⚠️ Sorry, I couldn't process that answer (${error.message || "timeout"}). Please try again or rephrase your response.` 
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, activeQuestion, projectText, companion?.id]);

  // ── Web Speech API ───────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.start();
    setIsRecording(true);
  }, []);

  const stopRecordingAndSend = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    if (transcript.trim()) {
      sendAnswer(transcript, true);
    }
  }, [transcript, sendAnswer]);

  return (
    <CosmicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={() => phase === "input" ? router.push("/journey") : setPhase(phase === "chat" ? "questions" : "input")}
            className="text-white/40 hover:text-white text-xs transition-colors"
          >
            ← {phase === "input" ? "Journey" : phase === "questions" ? "Edit Project" : "Questions"}
          </button>
          <div className="text-center">
            <p className="text-[10px] tracking-[0.4em] text-purple-400/70 uppercase mb-0.5">Project AI</p>
            <h1 className="text-xl font-extrabold tracking-widest bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              Project Analyzer
            </h1>
          </div>
          <div className="text-xs text-white/30">
            {phase === "questions" ? `${questions.length} questions` : ""}
          </div>
        </motion.div>

        {/* Phase: INPUT */}
        <AnimatePresence mode="wait">
          {phase === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-3xl mx-auto w-full"
            >
              <div className="text-center mb-8">
                <p className="text-5xl mb-4">🛰️</p>
                <h2 className="text-2xl font-bold text-white mb-2">Drop Your Project Here</h2>
                <p className="text-sm text-white/40">
                  Upload your project file and I&apos;ll generate tailored interview questions for it
                </p>
              </div>

              <div className="w-full">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {/* Drag & Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  className="w-full mb-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-5 cursor-pointer transition-all select-none"
                  style={{
                    borderColor: isDragOver ? color : "rgba(255,255,255,0.12)",
                    background: isDragOver ? `${color}11` : "rgba(255,255,255,0.03)",
                    boxShadow: isDragOver ? `0 0 24px ${color}33` : "none",
                  }}
                >
                  <span className="text-2xl">{isDragOver ? "📂" : "📁"}</span>
                  <p className="text-xs text-white/50 font-medium">
                    {isDragOver ? "Drop your file here" : "Drag & drop a file, or click to browse"}
                  </p>
                  <p className="text-[10px] text-white/25">Accepted: .txt · .md · .pdf</p>
                </div>

                {!!uploadError && (
                  <div className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                    {uploadError}
                  </div>
                )}

                {uploadedFileName && (
                  <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Uploaded File</p>
                    <p className="text-sm text-white/85 font-medium mb-2">{uploadedFileName}</p>
                    <p className="text-[11px] text-white/50 mb-3">{projectText.length.toLocaleString()} characters extracted</p>
                    <div className="max-h-28 overflow-y-auto rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/60 leading-relaxed">
                      {projectText.slice(0, 1200)}
                      {projectText.length > 1200 ? "..." : ""}
                    </div>
                  </div>
                )}

                {!uploadedFileName && (
                  <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center">
                    <p className="text-xs text-white/45">Upload a project file first to generate interview questions.</p>
                  </div>
                )}

                <motion.button
                  whileHover={projectText.trim() ? { scale: 1.03 } : {}}
                  whileTap={projectText.trim() ? { scale: 0.97 } : {}}
                  onClick={analyzeProject}
                  disabled={!projectText.trim() || loading || extracting}
                  className="w-full py-4 rounded-2xl text-sm font-bold tracking-widest uppercase transition-all"
                  style={{
                    background: projectText.trim() ? `linear-gradient(135deg, ${color}, #3b82f6)` : "rgba(255,255,255,0.07)",
                    border: `1px solid ${projectText.trim() ? color + "66" : "rgba(255,255,255,0.1)"}`,
                    color: projectText.trim() ? "#fff" : "rgba(255,255,255,0.3)",
                    boxShadow: projectText.trim() ? `0 0 40px ${color}33` : "none",
                    cursor: projectText.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>⚙️</motion.span>
                      Analyzing Project...
                    </span>
                  ) : extracting ? "Extracting File..." : "🔍 Analyze & Generate Questions"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Phase: QUESTIONS */}
          {phase === "questions" && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col px-6 py-6 max-w-3xl mx-auto w-full"
            >
              <div className="mb-6">
                <div
                  className="rounded-2xl p-4 mb-6"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Your Project</p>
                  <p className="text-xs text-white/60 leading-relaxed line-clamp-3">{projectText}</p>
                </div>
                <h2 className="text-lg font-bold text-white mb-1">Interview Questions Generated</h2>
                <p className="text-xs text-white/40">Click a question to start your voice/text practice session</p>
              </div>

              <div className="space-y-3">
                {!questions.length && (
                  <div className="rounded-2xl p-5 border border-white/10 bg-white/[0.03]">
                    <p className="text-sm text-white/75">No questions generated yet. Please upload a valid project file and try again.</p>
                  </div>
                )}
                {questions.map((q, i) => (
                  <motion.button
                    key={q.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => startQuestion(q)}
                    className="w-full text-left rounded-2xl p-5 flex items-start gap-4 group transition-all"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 mt-0.5"
                      style={{ background: `${color}33`, color, border: `1px solid ${color}55` }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white/85 group-hover:text-white transition-colors">{q.question}</p>
                    </div>
                    <span className="text-white/25 group-hover:text-white/60 text-lg transition-colors mt-0.5">→</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Phase: CHAT (Voice / Text Q&A) */}
          {phase === "chat" && activeQuestion && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col max-w-3xl mx-auto w-full"
            >
              {/* Active question banner */}
              <div
                className="mx-6 mt-4 rounded-2xl px-5 py-3"
                style={{ background: `${color}18`, border: `1px solid ${color}44` }}
              >
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Current Question</p>
                <p className="text-sm font-semibold" style={{ color }}>{activeQuestion.question}</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}
                  >
                    {msg.role === "assistant" && (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                        style={{ background: `radial-gradient(circle, ${color}cc, ${color}44)`, border: `1px solid ${color}66` }}
                      >
                        {emoji}
                      </div>
                    )}
                    <div
                      className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                      style={
                        msg.role === "user"
                          ? { background: `${color}33`, border: `1px solid ${color}44`, color: "rgba(255,255,255,0.9)" }
                          : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.82)" }
                      }
                    >
                      {msg.isVoice && <span className="text-[10px] text-white/40 block mb-1">🎤 Voice</span>}
                      {msg.content}
                    </div>
                  </motion.div>
                ))}

                {loading && (
                  <div className="flex justify-start gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: `${color}44`, border: `1px solid ${color}66` }}>{emoji}</div>
                    <div className="flex gap-1.5 px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10">
                      {[0, 0.15, 0.3].map((d) => (
                        <motion.div key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: color }}
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: d }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Voice / Text input area */}
              <div className="px-6 pb-6 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {/* Voice transcript preview */}
                {isRecording && (
                  <div className="mb-3 px-4 py-3 rounded-xl text-sm text-white/70 min-h-[60px]"
                    style={{ background: `${color}15`, border: `1px solid ${color}44` }}>
                    {transcript || <span className="text-white/30 italic">Listening... speak now</span>}
                  </div>
                )}

                <div className="flex gap-3 items-center">
                  {/* Text input */}
                  <input
                    className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500/50 transition-colors"
                    placeholder="Type your answer or use voice below..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendAnswer(textInput)}
                  />

                  {/* Send text button */}
                  <button
                    onClick={() => sendAnswer(textInput)}
                    disabled={!textInput.trim() || loading}
                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ background: `${color}33`, border: `1px solid ${color}55`, color }}
                  >
                    ↑
                  </button>

                  {/* Voice button */}
                  {micSupported && (
                    <motion.button
                      onClick={isRecording ? stopRecordingAndSend : startRecording}
                      animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all"
                      style={{
                        background: isRecording ? `${color}66` : `${color}22`,
                        border: `1.5px solid ${isRecording ? color : color + "55"}`,
                        boxShadow: isRecording ? `0 0 20px ${color}66` : "none",
                      }}
                    >
                      {isRecording ? "⏹️" : "🎤"}
                    </motion.button>
                  )}
                </div>

                <p className="text-[10px] text-white/25 text-center mt-2">
                  {micSupported ? "🎤 Hold mic to record your voice answer · AI will correct and improve it" : "Type your answer and get AI feedback"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <FloatingCompanion />
    </CosmicLayout>
  );
}
