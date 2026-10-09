"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle, TrendingUp, AlertCircle, Star,
  Eye, Mic, Brain, Smile, Activity, ChevronRight, RotateCcw, Trophy,
} from "lucide-react";
import { useUserStore } from "@/lib/userStore";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Scores {
  overall: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  clarity: number;
  confidence: number;
  leadership: number;
  positivity: number;
}

interface Results {
  scores: Scores;
  summary: string;
  strengths: string[];
  improvements: string[];
  starFeedback: string;
  grammarNote: string;
  eyeContact: number;
  fillerWords: number;
  company: string;
  role: string;
  experience: string;
  mode: string;
  answerScores: number[];
  transcript?: Array<{ role: string; content: string }>;
  idealAnswers?: Array<{ question: string; userAnswer: string; idealAnswer: string }>;
  actionChecklist?: string[];
  finalScore?: number;
  starRating?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COMPANY_COLORS: Record<string, string> = {
  google: "#4285F4", amazon: "#FF9900", microsoft: "#00A4EF",
  apple: "#888", deloitte: "#86BC25", tcs: "#0073CF", accenture: "#A100FF",
};

function gradeColor(score: number) {
  if (score >= 80) return "#34d399";
  if (score >= 65) return "#fbbf24";
  if (score >= 50) return "#fb923c";
  return "#f87171";
}

function gradeLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Average";
  if (score >= 45) return "Needs Work";
  return "Poor";
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 100, strokeWidth = 8, color }: { score: number; size?: number; strokeWidth?: number; color: string }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
      />
    </svg>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, icon, color }: { label: string; score: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-white/70">
          <span style={{ color }}>{icon}</span>
          {label}
        </div>
        <span className="font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<Results | null>(null);
  const [showXPGain, setShowXPGain] = useState(false);
  const [xpGained, setXPGained] = useState(0);
  const { profile, incrementInterviews, updateScore, addXP, updateStreak, addBadge } = useUserStore();
  const rewardsAppliedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("interviewResults");
      if (raw) {
        const data = JSON.parse(raw);
        setResults(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!results || !profile || rewardsAppliedRef.current) return;
    rewardsAppliedRef.current = true;

    const score = results.scores?.overall ?? results.finalScore ?? 70;
    const baseXP = 100;
    const bonusXP = Math.floor(score * 2);
    const totalXP = baseXP + bonusXP;

    setXPGained(totalXP);
    setShowXPGain(true);

    incrementInterviews();
    updateScore(score);
    addXP(totalXP);
    updateStreak();

    if (score >= 90) addBadge("excellence");
    if ((profile.totalInterviews ?? 0) + 1 >= 5) addBadge("consistent");
    if ((profile.streak ?? 0) + 1 >= 7) addBadge("week-streak");
  }, [results, profile, incrementInterviews, updateScore, addXP, updateStreak, addBadge]);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/home");
    }, 10000);
    return () => clearTimeout(timer);
  }, [router]);

  if (!results) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#050012] flex flex-col items-center justify-center text-slate-900 dark:text-white transition-colors duration-300 gap-4">
        <AlertCircle className="w-12 h-12 text-yellow-400" />
        <p className="text-slate-600 dark:text-white/60">No interview results found.</p>
        <button onClick={() => router.push("/interview/setup")}
          className="px-6 py-3 rounded-full bg-purple-700 text-sm font-semibold hover:bg-purple-600 transition">
          Start New Interview
        </button>
      </div>
    );
  }

  const { summary, strengths, improvements, starFeedback, grammarNote, eyeContact, fillerWords, company, role, experience, mode, answerScores } = results;
  const scores = results.scores ?? {
    overall: results.finalScore ?? 0,
    fluency: 0,
    grammar: 0,
    vocabulary: 0,
    clarity: 0,
    confidence: 0,
    leadership: 0,
    positivity: 0,
  };
  const accentColor = COMPANY_COLORS[company] ?? "#7c3aed";
  const overall = scores.overall ?? 0;
  const finalScore = results.finalScore ?? overall;
  const starRating = results.starRating ?? Math.max(1, Math.min(5, Math.round(finalScore / 20)));
  const actionChecklist = results.actionChecklist ?? improvements?.slice(0, 5) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050012] text-slate-900 dark:text-white transition-colors duration-300 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <p className="text-xs tracking-[0.4em] text-slate-500 dark:text-white/30 uppercase mb-2">Interview Complete</p>
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-white/80 dark:to-white/50 bg-clip-text text-transparent mb-1">
            Your Results
          </h1>
          <p className="text-slate-600 dark:text-white/40 text-sm capitalize">
            {role?.replace(/-/g, " ")} · {experience} · {company} style · {mode} mode
          </p>
          
          {/* XP Gain Notification */}
          {showXPGain && xpGained > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-purple-500/20 border border-yellow-500/30"
            >
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">+{xpGained} XP</span>
            </motion.div>
          )}
        </motion.div>

        {/* ── Overall score card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-8"
          style={{ background: `linear-gradient(135deg, ${accentColor}18, #0e0e1a)`, border: `1px solid ${accentColor}35` }}
        >
          <div className="relative flex-shrink-0">
            <ScoreRing score={overall} size={140} strokeWidth={10} color={accentColor} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black" style={{ color: accentColor }}>{overall}</span>
              <span className="text-xs text-slate-500 dark:text-white/40">/ 100</span>
            </div>
          </div>
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold mb-3"
              style={{ background: `${gradeColor(overall)}20`, color: gradeColor(overall), border: `1px solid ${gradeColor(overall)}40` }}>
              <Star className="w-4 h-4" />
              {gradeLabel(overall)}
            </div>
            <p className="text-slate-700 dark:text-white/80 text-sm leading-relaxed max-w-md">{summary}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-white/50">Rating:</span>
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={i < starRating ? "text-yellow-400" : "text-slate-400 dark:text-white/20"}>★</span>
                ))}
              </div>
              <span className="text-xs text-slate-500 dark:text-white/50">{finalScore}%</span>
            </div>
          </div>
        </motion.div>

        {/* ── Score grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Communication */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl p-6 space-y-4 bg-[#0e0e1a] border border-white/10"
          >
            <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
              <Mic className="w-4 h-4 text-blue-400" /> Communication
            </h2>
            <ScoreBar label="Fluency"    score={scores.fluency    ?? 0} icon={<Activity className="w-3.5 h-3.5" />} color="#60a5fa" />
            <ScoreBar label="Grammar"    score={scores.grammar    ?? 0} icon={<Brain className="w-3.5 h-3.5" />}    color="#a78bfa" />
            <ScoreBar label="Vocabulary" score={scores.vocabulary ?? 0} icon={<Star className="w-3.5 h-3.5" />}     color="#34d399" />
            <ScoreBar label="Clarity"    score={scores.clarity    ?? 0} icon={<CheckCircle className="w-3.5 h-3.5" />} color="#fbbf24" />

            {/* Filler words note */}
            <div className="mt-2 px-3 py-2 rounded-xl bg-white/5 text-xs text-white/50 flex justify-between">
              <span>Filler words detected</span>
              <span className={fillerWords > 10 ? "text-red-400" : fillerWords > 5 ? "text-yellow-400" : "text-green-400"}>
                {fillerWords} {fillerWords <= 3 ? "✅" : fillerWords <= 8 ? "⚠️" : "❌"}
              </span>
            </div>
            {grammarNote && <p className="text-xs text-white/40 italic">{grammarNote}</p>}
          </motion.div>

          {/* Confidence & Behavior */}
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
            className="rounded-2xl p-6 space-y-4 bg-[#0e0e1a] border border-white/10"
          >
            <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" /> Confidence & Behavior
            </h2>
            <ScoreBar label="Confidence"  score={scores.confidence  ?? 0} icon={<TrendingUp className="w-3.5 h-3.5" />} color="#e879f9" />
            <ScoreBar label="Leadership"  score={scores.leadership  ?? 0} icon={<Star className="w-3.5 h-3.5" />}       color="#f472b6" />
            <ScoreBar label="Positivity"  score={scores.positivity  ?? 0} icon={<Smile className="w-3.5 h-3.5" />}      color="#fb923c" />
            <ScoreBar label="Eye Contact" score={eyeContact ?? 0}          icon={<Eye className="w-3.5 h-3.5" />}         color="#38bdf8" />

            {starFeedback && (
              <div className="mt-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/25 text-xs text-purple-300">
                ⭐ {starFeedback}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Per-answer scores ── */}
        {answerScores?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-2xl p-6 bg-[#0e0e1a] border border-white/10"
          >
            <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" /> Answer Breakdown
            </h2>
            <div className="flex gap-4 flex-wrap">
              {answerScores.map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <ScoreRing score={s} size={72} strokeWidth={6} color={gradeColor(s)} />
                  <div className="relative -mt-[72px] flex items-center justify-center w-[72px] h-[72px] pointer-events-none">
                    <span className="text-sm font-bold" style={{ color: gradeColor(s) }}>{s}</span>
                  </div>
                  <span className="text-xs text-white/40">Q{i + 1}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Strengths & Improvements ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="rounded-2xl p-6 bg-[#0e0e1a] border border-white/10"
          >
            <h2 className="text-sm font-bold text-green-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Strengths
            </h2>
            <ul className="space-y-3">
              {(strengths ?? []).map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-[10px] text-green-400 font-bold flex-shrink-0">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="rounded-2xl p-6 bg-[#0e0e1a] border border-white/10"
          >
            <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Areas to Improve
            </h2>
            <ul className="space-y-3">
              {(improvements ?? []).map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-[10px] text-yellow-400 font-bold flex-shrink-0">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* ── Transcript Section ── */}
        {results.transcript && results.transcript.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="rounded-2xl p-6 bg-[#0e0e1a] border border-white/10"
          >
            <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" /> Q&A Transcript
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.transcript.map((item, i) => (
                <div key={i} className={`p-3 rounded-xl ${item.role === 'user' ? 'bg-purple-500/10 border-l-2 border-purple-500' : 'bg-blue-500/10 border-l-2 border-blue-500'}`}>
                  <div className="text-xs font-bold mb-1 text-white/60">{item.role === 'user' ? 'You' : 'Interviewer'}</div>
                  <div className="text-sm text-white/80">{item.content}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Ideal answers + checklist ── */}
        {results.idealAnswers && results.idealAnswers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}
            className="rounded-2xl p-6 bg-[#0e0e1a] border border-white/10"
          >
            <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-4">
              Ideal Answers Comparison
            </h2>
            <div className="space-y-4">
              {results.idealAnswers.map((item, i) => (
                <div key={i} className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
                  <p className="text-xs text-purple-300 mb-2">Q{i + 1}: {item.question}</p>
                  <p className="text-xs text-white/60 mb-1">Your Answer</p>
                  <p className="text-sm text-white/85 mb-3">{item.userAnswer}</p>
                  <p className="text-xs text-green-300 mb-1">Ideal Answer</p>
                  <p className="text-sm text-green-100/90">{item.idealAnswer}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {actionChecklist.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}
            className="rounded-2xl p-6 bg-[#0e0e1a] border border-white/10"
          >
            <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-4">
              Action Checklist (Next Steps)
            </h2>
            <ul className="space-y-2">
              {actionChecklist.slice(0, 5).map((item, i) => (
                <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">□</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* ── Action buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="flex flex-col sm:flex-row gap-4 pb-8"
        >
          <button
            onClick={() => router.push("/interview/setup")}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02]"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}88)`, boxShadow: `0 0 30px ${accentColor}44` }}
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={() => router.push("/dashboard/performance")}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30"
          >
            View Performance Dashboard
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
        
        {/* Auto-redirect notification */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center text-white/40 text-sm"
        >
          Redirecting to dashboard in 10 seconds...
        </motion.p>
      </div>
    </div>
  );
}
