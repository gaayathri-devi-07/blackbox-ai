"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { PolarAngleAxis, PolarGrid, RadialBar, RadialBarChart, Radar, RadarChart, ResponsiveContainer } from "recharts";

type Metric = { name: string; value: number; fill: string };
type SessionHistory = {
  timestamp: number;
  finalScore: number;
  eyeContact: number;
  answerScores: number[];
  transcript?: Array<{ role: "user" | "assistant"; content: string }>;
};

export default function PerformanceDashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metric[]>([
    { name: "Eye Contact", value: 0, fill: "#38bdf8" },
    { name: "Communication", value: 0, fill: "#a78bfa" },
    { name: "Answer Logic", value: 0, fill: "#34d399" },
  ]);
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("interviewResults");
    const historyRaw = localStorage.getItem("interviewSessionHistory");
    try {
      const historySessions: SessionHistory[] = historyRaw ? JSON.parse(historyRaw) : [];
      const latest = raw ? JSON.parse(raw) : null;
      const sessions = historySessions.length ? historySessions : latest ? [{
        timestamp: Date.now(),
        finalScore: Number(latest.finalScore ?? latest.scores?.overall ?? 0),
        eyeContact: Number(latest.eyeContact ?? 0),
        answerScores: Array.isArray(latest.answerScores) ? latest.answerScores : [],
        transcript: Array.isArray(latest.transcript) ? latest.transcript : [],
      }] : [];
      if (!sessions.length) return;

      const totalAnswers = sessions.reduce((acc, s) => acc + (s.answerScores?.length ?? 0), 0);
      const answerAvg = totalAnswers
        ? sessions.reduce((acc, s) => acc + s.answerScores.reduce((a, b) => a + b, 0), 0) / totalAnswers
        : 0;
      const transcriptWordScores = sessions.map((s) => {
        const words = (s.transcript ?? [])
          .filter((t) => t.role === "user")
          .reduce((count, t) => count + t.content.split(/\s+/).filter(Boolean).length, 0);
        return Math.min(100, Math.round((words / 120) * 100));
      });
      const communicationScore = Math.round(
        sessions.reduce((acc, s) => acc + Math.max(0, Math.min(100, Number(s.finalScore ?? 0))), 0) / sessions.length
      );
      const eyeScore = Math.round(
        sessions.reduce((acc, s) => acc + Math.max(0, Math.min(100, Number(s.eyeContact ?? 0))), 0) / sessions.length
      );
      const logicScore = Math.round(Math.max(answerAvg, 0));
      const transcriptScore = transcriptWordScores.length
        ? Math.round(transcriptWordScores.reduce((a, b) => a + b, 0) / transcriptWordScores.length)
        : communicationScore;

      setMetrics([
        { name: "Eye Contact", value: eyeScore, fill: "#38bdf8" },
        { name: "Communication", value: communicationScore, fill: "#a78bfa" },
        { name: "Answer Logic", value: logicScore, fill: "#34d399" },
        { name: "Transcript Depth", value: transcriptScore, fill: "#fb7185" },
      ]);

      const flattened = sessions
        .slice(0, 8)
        .flatMap((s) => s.answerScores ?? [])
        .slice(0, 16);
      setHistory(flattened);
    } catch {
      // keep defaults
    }
  }, []);

  const overall = useMemo(() => Math.round(metrics.reduce((a, m) => a + m.value, 0) / metrics.length), [metrics]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#05050A] text-slate-900 dark:text-white px-4 py-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-white/40">Dashboard</p>
            <h1 className="text-3xl font-black">Performance Analytics</h1>
          </div>
          <button
            onClick={() => router.push("/journey")}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-sm hover:bg-slate-100 dark:hover:bg-white/5"
          >
            Back
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6 bg-white dark:bg-[#0e0e1a] border border-slate-200 dark:border-white/10"
        >
          <p className="text-sm text-slate-500 dark:text-white/50 mb-2">Overall Score</p>
          <p className="text-5xl font-black">{overall}<span className="text-xl text-slate-500 dark:text-white/40">/100</span></p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl p-6 bg-white dark:bg-[#0e0e1a] border border-slate-200 dark:border-white/10 h-[360px]"
          >
            <p className="text-sm mb-3 text-slate-500 dark:text-white/50">Animated Radial Progress</p>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="20%" outerRadius="95%" data={metrics} startAngle={180} endAngle={-180}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl p-6 bg-white dark:bg-[#0e0e1a] border border-slate-200 dark:border-white/10 h-[360px]"
          >
            <p className="text-sm mb-3 text-slate-500 dark:text-white/50">Skill Radar</p>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={metrics}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" />
                <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {history.length > 0 && (
          <div className="rounded-2xl p-6 bg-white dark:bg-[#0e0e1a] border border-slate-200 dark:border-white/10">
            <p className="text-sm mb-3 text-slate-500 dark:text-white/50">Recent Answer Scores</p>
            <div className="flex gap-2 flex-wrap">
              {history.map((h, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-xs bg-slate-200 dark:bg-white/10">{`Q${i + 1}: ${h}`}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

