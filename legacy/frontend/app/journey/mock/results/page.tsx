"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { CosmicLayout, FloatingCompanion } from "@/components/use-companion";

interface Scores {
  overall: number;
  confidence: number;
  communication: number;
  technicalDepth: number;
  clarity: number;
  eyeContact: number;
}

const SCORE_META = [
  { key: "confidence", label: "Confidence", icon: "💪", color: "#a78bfa" },
  { key: "communication", label: "Communication", icon: "🗣️", color: "#60a5fa" },
  { key: "technicalDepth", label: "Technical Depth", icon: "🧠", color: "#34d399" },
  { key: "clarity", label: "Clarity", icon: "🎯", color: "#fbbf24" },
  { key: "eyeContact", label: "Eye Contact", icon: "👁️", color: "#f472b6" },
] as const;

// Radar chart for scores
function ScoreRadar({ scores }: { scores: Scores }) {
  const labels = SCORE_META.map((m) => m.label);
  const values = SCORE_META.map((m) => scores[m.key] * 10); // scale to 0-100
  const cx = 130, cy = 130, r = 100;
  const n = labels.length;
  const levels = [0.25, 0.5, 0.75, 1.0];

  const pt = (val: number, i: number, scale = 1) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * r * (val / 100) * scale,
      y: cy + Math.sin(angle) * r * (val / 100) * scale,
    };
  };

  const dataPath = values.map((v, i) => {
    const p = pt(v, i);
    return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ") + " Z";

  return (
    <svg width={260} height={260} className="overflow-visible">
      {levels.map((l) => (
        <polygon key={l}
          points={Array.from({ length: n }, (_, i) => { const p = pt(100, i, l); return `${p.x},${p.y}`; }).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1}
        />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const p = pt(100, i);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
      })}
      <path d={dataPath} fill="rgba(124,58,237,0.22)" stroke="#7c3aed" strokeWidth={2} />
      {values.map((v, i) => {
        const p = pt(v, i);
        const m = SCORE_META[i];
        return <circle key={i} cx={p.x} cy={p.y} r={4} fill={m.color} />;
      })}
      {labels.map((label, i) => {
        const p = pt(100, i, 1.28);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="rgba(255,255,255,0.5)">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

const COMPANY_META: Record<string, { name: string; color: string; logo: string }> = {
  google: { name: "Google", color: "#4285F4", logo: "🔵" },
  amazon: { name: "Amazon", color: "#FF9900", logo: "🟠" },
  microsoft: { name: "Microsoft", color: "#00A4EF", logo: "🪟" },
  meta: { name: "Meta", color: "#0668E1", logo: "🔷" },
  startup: { name: "Startup", color: "#a78bfa", logo: "🚀" },
};

function getGrade(score: number): { grade: string; color: string; label: string } {
  if (score >= 90) return { grade: "S", color: "#fbbf24", label: "Interview Ready! 🌟" };
  if (score >= 80) return { grade: "A", color: "#34d399", label: "Excellent Performance!" };
  if (score >= 70) return { grade: "B", color: "#60a5fa", label: "Good Job! Keep Practicing" };
  if (score >= 60) return { grade: "C", color: "#a78bfa", label: "Decent. Room to Improve" };
  return { grade: "D", color: "#f87171", label: "Keep Practicing!" };
}

export default function InterviewResults() {
  const router = useRouter();
  const [scores, setScores] = useState<Scores | null>(null);
  const [summary, setSummary] = useState("");
  const [strengths, setStrengths] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [company, setCompany] = useState("startup");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResults = async () => {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("interviewData") : null;
        const data = raw ? JSON.parse(raw) : null;

        if (data) {
          setCompany(data.company ?? "startup");

          const res = await fetch("/api/interview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "evaluate",
              company: data.company,
              messages: data.messages ?? [],
            }),
          });
          const result = await res.json();
          setScores(result.scores ?? { overall: 72, confidence: 7, communication: 7, technicalDepth: 7, clarity: 7, eyeContact: 6 });
          setSummary(result.summary ?? "Great effort on your mock interview!");
          setStrengths(result.strengths ?? []);
          setImprovements(result.improvements ?? []);
        } else {
          // Fallback demo scores
          setScores({ overall: 74, confidence: 7, communication: 8, technicalDepth: 7, clarity: 7, eyeContact: 6 });
          setSummary("Great effort! You demonstrated solid communication skills and technical knowledge.");
          setStrengths(["Clear articulation", "Good technical examples", "Showed enthusiasm"]);
          setImprovements(["Use more specific metrics", "Structure with STAR format", "Maintain consistent eye contact"]);
        }
      } catch {
        setScores({ overall: 70, confidence: 7, communication: 7, technicalDepth: 7, clarity: 7, eyeContact: 6 });
        setSummary("Interview completed! Keep practicing to improve your scores.");
        setStrengths(["Completed the interview", "Answered all questions"]);
        setImprovements(["Add OPENAI_API_KEY for personalized feedback"]);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, []);

  const meta = COMPANY_META[company] ?? COMPANY_META.startup;
  const grade = scores ? getGrade(scores.overall) : null;

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
          <button onClick={() => router.push("/journey/mock")} className="text-white/40 hover:text-white text-xs transition-colors">
            ← New Interview
          </button>
          <div className="text-center">
            <p className="text-[10px] tracking-[0.4em] text-yellow-400/70 uppercase mb-0.5">Results</p>
            <h1 className="text-xl font-extrabold tracking-widest bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              Performance Report
            </h1>
          </div>
          <button onClick={() => router.push("/home")} className="text-white/40 hover:text-white text-xs transition-colors">
            Dashboard →
          </button>
        </motion.div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <motion.div className="text-5xl mb-4" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>⚙️</motion.div>
              <p className="text-sm text-white/40">Evaluating your performance...</p>
            </div>
          </div>
        ) : scores && grade && (
          <div className="flex-1 overflow-y-auto px-6 py-6 max-w-5xl mx-auto w-full">
            {/* Hero score */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="text-center mb-8"
            >
              <span className="text-5xl mb-3 block">{meta.logo}</span>
              <p className="text-sm text-white/40 mb-4">{meta.name} Mock Interview</p>

              <div className="inline-flex items-center gap-4 mb-4">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black border-4"
                  style={{
                    borderColor: grade.color,
                    background: `${grade.color}22`,
                    color: grade.color,
                    boxShadow: `0 0 40px ${grade.color}55`,
                  }}
                >
                  {grade.grade}
                </div>
                <div className="text-left">
                  <p className="text-3xl font-black text-white">{scores.overall}<span className="text-lg text-white/40">/100</span></p>
                  <p className="text-sm" style={{ color: grade.color }}>{grade.label}</p>
                </div>
              </div>

              <p className="text-sm text-white/60 max-w-lg mx-auto leading-relaxed">{summary}</p>
            </motion.div>

            {/* Main grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              {/* Radar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-3xl p-5 flex flex-col items-center"
                style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <p className="text-[11px] text-white/50 tracking-widest uppercase mb-4">Skill Radar</p>
                <ScoreRadar scores={scores} />
              </motion.div>

              {/* Score breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-3xl p-5"
                style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <p className="text-[11px] text-white/50 tracking-widest uppercase mb-4">Score Breakdown</p>
                <div className="space-y-4">
                  {SCORE_META.map((m, i) => (
                    <motion.div
                      key={m.key}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span>{m.icon}</span>
                          <span className="text-xs text-white/70">{m.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black" style={{ color: m.color }}>{scores[m.key]}</span>
                          <span className="text-xs text-white/30">/10</span>
                          {/* Stars */}
                          <div className="flex gap-0.5">
                            {Array.from({ length: 10 }, (_, j) => (
                              <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: j < scores[m.key] ? m.color : "rgba(255,255,255,0.1)" }} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${m.color}88, ${m.color})` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${scores[m.key] * 10}%` }}
                          transition={{ duration: 1.2, delay: 0.4 + i * 0.08, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Strengths & improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-3xl p-5"
                style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)" }}
              >
                <p className="text-[11px] text-green-400/70 tracking-widest uppercase mb-4">✅ Strengths</p>
                <div className="space-y-2">
                  {strengths.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.08 }}
                      className="flex items-start gap-2 text-sm text-white/70"
                    >
                      <span className="text-green-400 mt-0.5">•</span>
                      {s}
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="rounded-3xl p-5"
                style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}
              >
                <p className="text-[11px] text-yellow-400/70 tracking-widest uppercase mb-4">💡 Areas to Improve</p>
                <div className="space-y-2">
                  {improvements.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.08 }}
                      className="flex items-start gap-2 text-sm text-white/70"
                    >
                      <span className="text-yellow-400 mt-0.5">→</span>
                      {s}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* CTAs */}
            <div className="flex gap-4 justify-center pb-4">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push("/journey/practice")}
                className="px-8 py-3.5 rounded-2xl text-sm font-bold tracking-wide"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
              >
                📚 Back to Practice
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push(`/journey/mock/${company}`)}
                className="px-8 py-3.5 rounded-2xl text-sm font-black tracking-widest uppercase"
                style={{
                  background: `linear-gradient(135deg, ${meta.color}, #7c3aed)`,
                  boxShadow: `0 0 30px ${meta.color}44`,
                }}
              >
                🔄 Retry Interview
              </motion.button>
            </div>
          </div>
        )}
      </div>

      <FloatingCompanion />
    </CosmicLayout>
  );
}
