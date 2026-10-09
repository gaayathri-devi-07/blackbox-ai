"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { StarField } from "@/components/star-field";

// ── SVG Radar Chart ─────────────────────────────────────────────────────────
const RADAR_LABELS = ["Communication", "Confidence", "Technical", "Body Language", "Eye Contact", "Posture"];

function RadarChart({ size = 200, values }: { size?: number; values: number[] }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const n = RADAR_LABELS.length;
  const levels = [0.25, 0.5, 0.75, 1.0];

  const pt = (val: number, i: number, scale = 1) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * r * (val / 100) * scale,
      y: cy + Math.sin(angle) * r * (val / 100) * scale,
    };
  };
  const axPt = (i: number, scale = 1) => pt(100, i, scale);

  const dataPath = values.map((v, i) => {
    const p = pt(v, i);
    return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ") + " Z";

  return (
    <svg width={size} height={size} className="overflow-visible">
      {/* Grid rings */}
      {levels.map((l) => (
        <polygon
          key={l}
          points={Array.from({ length: n }, (_, i) => {
            const p = axPt(i, l);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const p = axPt(i);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />;
      })}
      {/* Data fill */}
      <path d={dataPath} fill="rgba(139,92,246,0.25)" stroke="#8b5cf6" strokeWidth={1.5} />
      {/* Dots */}
      {values.map((v, i) => {
        const p = pt(v, i);
        return <circle key={i} cx={p.x} cy={p.y} r={3} fill="#a78bfa" />;
      })}
      {/* Labels */}
      {RADAR_LABELS.map((label, i) => {
        const p = axPt(i, 1.22);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill="rgba(255,255,255,0.55)"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ── SVG Line Chart ───────────────────────────────────────────────────────────
function LineChart({ w = 280, h = 110, data, labels }: { w?: number; h?: number; data: number[]; labels: string[] }) {
  const pad = { l: 24, r: 12, t: 10, b: 20 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const max = 100;

  // Need at least 2 points for a line; pad single-point arrays
  const safeData = data.length >= 2 ? data : data.length === 1 ? [0, data[0]] : [0];
  const safeLabels = data.length >= 2 ? labels : data.length === 1 ? ["S0", labels[0] ?? "S1"] : ["S1"];

  const pts = safeData.map((v, i) => ({
    x: pad.l + (i / Math.max(safeData.length - 1, 1)) * iw,
    y: pad.t + ih - (v / max) * ih,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = pathD + ` L ${pts[pts.length - 1].x} ${pad.t + ih} L ${pts[0].x} ${pad.t + ih} Z`;

  return (
    <svg width={w} height={h}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = pad.t + ih - (v / max) * ih;
        return (
          <g key={v}>
            <line x1={pad.l} y1={y} x2={pad.l + iw} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={pad.l - 4} y={y + 1} textAnchor="end" fontSize={7} fill="rgba(255,255,255,0.3)" dominantBaseline="middle">{v}</text>
          </g>
        );
      })}
      {/* Area gradient */}
      <defs>
        <linearGradient id="lineGradHome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#lineGradHome)" />
      <path d={pathD} fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#60a5fa" />
      ))}
      {/* X labels */}
      {pts.map((p, i) => (
        i % 2 === 0 && (
          <text key={i} x={p.x} y={h - 4} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.3)">{safeLabels[i]}</text>
        )
      ))}
    </svg>
  );
}

// ── Skill bars ───────────────────────────────────────────────────────────────
function SkillBars({ skills }: { skills: { name: string; pct: number; color: string }[] }) {
  return (
    <div className="space-y-2.5">
      {skills.map((s) => (
        <div key={s.name}>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-600 dark:text-white/60">{s.name}</span>
            <span style={{ color: s.color }}>{s.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-300 dark:bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${s.color}88, ${s.color})` }}
              initial={{ width: 0 }}
              animate={{ width: `${s.pct}%` }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Level badge ──────────────────────────────────────────────────────────────
// ── Levels ──────────────────────────────────────────────────────────────────
const LEVELS = ["Beginner", "Intermediate", "Advanced", "Elite", "Interview Ready"];
const LEVEL_COLORS = ["#60a5fa", "#34d399", "#a78bfa", "#f472b6", "#fbbf24"];

function getLevelIndex(avgScore: number): number {
  if (avgScore >= 90) return 4;
  if (avgScore >= 75) return 3;
  if (avgScore >= 60) return 2;
  if (avgScore >= 40) return 1;
  return 0;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function HomeDashboard() {
  const router = useRouter();
  const [companion, setCompanion] = useState<{ id: string; name: string } | null>(null);
  const [career, setCareer] = useState<string | null>(null);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleMsg, setBubbleMsg] = useState("");

  // ── Real stats state (start all at 0) ──────────────────────────────────
  const [blueStars, setBlueStars] = useState(0);    // practice count
  const [goldStars, setGoldStars] = useState(0);    // interview + gd count
  const [totalScore, setTotalScore] = useState(0);  // avg score
  const [levelIndex, setLevelIndex] = useState(0);
  const [radarValues, setRadarValues] = useState([0, 0, 0, 0, 0, 0]);
  const [progressData, setProgressData] = useState<number[]>([]);
  const [progressLabels, setProgressLabels] = useState<string[]>([]);
  const [skills, setSkills] = useState([
    { name: "Communication", pct: 0, color: "#a78bfa" },
    { name: "Confidence",    pct: 0, color: "#60a5fa" },
    { name: "Technical Depth", pct: 0, color: "#34d399" },
    { name: "Body Language", pct: 0, color: "#f472b6" },
    { name: "Eye Contact",   pct: 0, color: "#fbbf24" },
  ]);

  const COMPANION_EMOJIS: Record<string, string> = {
    luna: "🌙", nova: "⭐", stella: "✨", orion: "🌟", cosmo: "🪐",
  };
  const COMPANION_COLORS: Record<string, string> = {
    luna: "#a78bfa", nova: "#60a5fa", stella: "#f472b6", orion: "#34d399", cosmo: "#fbbf24",
  };
  const CAREER_LABELS: Record<string, string> = {
    "software-dev": "Software Developer",
    "ai-ml": "AI / ML Engineer",
    "data-scientist": "Data Scientist",
    "cloud-engineer": "Cloud Engineer",
    "product-analyst": "Product Analyst",
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load companion & career
    const c = localStorage.getItem("companion");
    if (c) setCompanion(JSON.parse(c));
    const car = localStorage.getItem("career");
    if (car) setCareer(car);

    // Bubble message
    const t = setTimeout(() => {
      setBubbleMsg("You can do this!! 🚀");
      setShowBubble(true);
      setTimeout(() => setShowBubble(false), 3000);
    }, 2000);

    // Fetch real stats
    let uid = localStorage.getItem("statsUserId");
    if (!uid) {
      uid = crypto.randomUUID();
      localStorage.setItem("statsUserId", uid);
    }
    fetch(`/api/interview?userId=${uid}`)
      .then((r) => r.json())
      .then((stats) => {
        if (!stats || stats.error) return;
        const sk = stats.skillScores ?? {};
        setBlueStars(stats.practiceCount ?? 0);
        setGoldStars((stats.interviewCount ?? 0) + (stats.gdCount ?? 0));
        setTotalScore(stats.avgScore ?? 0);
        setLevelIndex(getLevelIndex(stats.avgScore ?? 0));
        setRadarValues([
          sk.communication ?? 0,
          sk.confidence    ?? 0,
          sk.technical     ?? 0,
          sk.bodyLanguage  ?? 0,
          sk.eyeContact    ?? 0,
          sk.posture       ?? 0,
        ]);
        const history: { session: number; score: number; date: string }[] = stats.scoreHistory ?? [];
        setProgressData(history.map((h) => h.score));
        setProgressLabels(history.map((h) => `S${h.session}`));
        setSkills([
          { name: "Communication",  pct: sk.communication ?? 0, color: "#a78bfa" },
          { name: "Confidence",     pct: sk.confidence    ?? 0, color: "#60a5fa" },
          { name: "Technical Depth",pct: sk.technical     ?? 0, color: "#34d399" },
          { name: "Body Language",  pct: sk.bodyLanguage  ?? 0, color: "#f472b6" },
          { name: "Eye Contact",    pct: sk.eyeContact    ?? 0, color: "#fbbf24" },
        ]);
      })
      .catch(() => null);

    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#020010] text-slate-900 dark:text-white transition-colors duration-300">
      <StarField starCount={220} />

      {/* Nebula glows */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-purple-900/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-blue-900/15 blur-[100px]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top bar */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Profile */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #2563eb)",
                boxShadow: "0 0 20px rgba(124,58,237,0.5)",
              }}
            >
              {companion ? COMPANION_EMOJIS[companion.id] ?? "👤" : "👤"}
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-white/40">Welcome back</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {companion ? companion.name : "Explorer"}
                {career && <span className="text-slate-500 dark:text-white/40 font-normal"> · {CAREER_LABELS[career] ?? career}</span>}
              </p>
            </div>
          </div>

          {/* Stars + Level */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-base">⭐</span>
              <div>
                <p className="text-[9px] text-slate-500 dark:text-white/40">Practice</p>
                <p className="text-sm font-bold text-blue-300">{blueStars}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base">🌟</span>
              <div>
                <p className="text-[9px] text-slate-500 dark:text-white/40">Mock+GD</p>
                <p className="text-sm font-bold text-yellow-300">{goldStars}</p>
              </div>
            </div>
            <div
              className="px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide"
              style={{
                background: `${LEVEL_COLORS[levelIndex]}22`,
                border: `1px solid ${LEVEL_COLORS[levelIndex]}55`,
                color: LEVEL_COLORS[levelIndex],
              }}
            >
              {LEVELS[levelIndex]}
            </div>
          </div>
        </motion.header>

        {/* Dashboard body */}
        <div className="flex-1 px-6 py-6 overflow-y-auto">
          {/* Score + title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <p className="text-xs tracking-[0.4em] text-purple-400/70 uppercase mb-2">Your Progress Overview</p>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-widest bg-gradient-to-r from-purple-300 via-blue-300 to-pink-300 bg-clip-text text-transparent">
              Mission Control
            </h1>
            <div className="flex items-center justify-center gap-2 mt-3">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-2"
                style={{
                  borderColor: LEVEL_COLORS[levelIndex] + "88",
                  background: LEVEL_COLORS[levelIndex] + "18",
                  color: LEVEL_COLORS[levelIndex],
                  boxShadow: `0 0 30px ${LEVEL_COLORS[levelIndex]}44`,
                }}
              >
                {totalScore}
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-500 dark:text-white/40">Overall Score</p>
                <p className="text-sm font-semibold" style={{ color: LEVEL_COLORS[levelIndex] }}>
                  {LEVELS[levelIndex]}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Analytics grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">

            {/* Radar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-3xl p-5 flex flex-col items-center bg-white dark:bg-[#0A0A0F] text-gray-900 dark:text-white shadow-md dark:shadow-none border border-gray-200 dark:border-white/10"
            >
              <p className="text-[11px] text-slate-500 dark:text-white/50 tracking-widest uppercase mb-4">Skill Radar</p>
              <RadarChart size={180} values={radarValues} />
            </motion.div>

            {/* Progress line */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="rounded-3xl p-5 bg-white dark:bg-[#0A0A0F] text-gray-900 dark:text-white shadow-md dark:shadow-none border border-gray-200 dark:border-white/10"
            >
              <p className="text-[11px] text-slate-500 dark:text-white/50 tracking-widest uppercase mb-4">Progress Journey</p>
              <LineChart w={260} h={120} data={progressData} labels={progressLabels} />
              <div className="flex justify-between mt-3">
                <div>
                  <p className="text-[9px] text-slate-500 dark:text-white/35">Started</p>
                  <p className="text-xs font-bold text-blue-300">
                    {progressData.length > 0 ? `Score ${progressData[0]}` : "No data yet"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-500 dark:text-white/35">Current</p>
                  <p className="text-xs font-bold text-green-300">
                    {progressData.length > 0 ? `Score ${progressData[progressData.length - 1]}` : "Complete an interview"}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Skill bars */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="rounded-3xl p-5 bg-white dark:bg-[#0A0A0F] text-gray-900 dark:text-white shadow-md dark:shadow-none border border-gray-200 dark:border-white/10"
            >
              <p className="text-[11px] text-slate-500 dark:text-white/50 tracking-widest uppercase mb-4">Skill Breakdown</p>
              <SkillBars skills={skills} />
            </motion.div>
          </div>

          {/* Level path */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="max-w-5xl mx-auto mt-6 rounded-3xl p-5 bg-white dark:bg-[#0A0A0F] text-gray-900 dark:text-white shadow-md dark:shadow-none border border-gray-200 dark:border-white/10"
          >
            <p className="text-[11px] text-slate-500 dark:text-white/50 tracking-widest uppercase mb-4">Level Path</p>
            <div className="flex items-center justify-between">
              {LEVELS.map((lvl, i) => (
                <div key={lvl} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
                      style={{
                        borderColor: i <= levelIndex ? LEVEL_COLORS[i] : "rgba(255,255,255,0.15)",
                        background: i <= levelIndex ? LEVEL_COLORS[i] + "30" : "transparent",
                          color: i <= levelIndex ? LEVEL_COLORS[i] : "rgba(100,116,139,0.8)",
                        boxShadow: i === levelIndex ? `0 0 16px ${LEVEL_COLORS[i]}60` : "none",
                      }}
                    >
                      {i < levelIndex ? "✓" : i === levelIndex ? "★" : i + 1}
                    </div>
                    <p className="text-[8px] mt-1 text-center max-w-[60px] leading-tight" style={{ color: i <= levelIndex ? LEVEL_COLORS[i] : "rgba(100,116,139,0.8)" }}>
                      {lvl}
                    </p>
                  </div>
                  {i < LEVELS.length - 1 && (
                    <div
                      className="flex-1 h-0.5 mx-2 rounded-full"
                      style={{
                        width: 40,
                        background: i < levelIndex ? `linear-gradient(90deg, ${LEVEL_COLORS[i]}, ${LEVEL_COLORS[i + 1]})` : "rgba(148,163,184,0.35)",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
            className="flex justify-center mt-8 mb-4"
          >
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/journey")}
              className="px-14 py-5 rounded-full text-base font-black tracking-widest uppercase relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #2563eb, #0ea5e9)",
                boxShadow: "0 0 60px rgba(124,58,237,0.5), 0 0 30px rgba(37,99,235,0.3)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.2), transparent)" }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="relative">🚀 Let&apos;s Start Journey</span>
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Floating companion */}
      {companion && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {showBubble && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl rounded-br-sm px-3 py-2 text-[11px] font-semibold max-w-[150px] text-center"
              style={{
                background: "rgba(10,5,30,0.88)",
                backdropFilter: "blur(20px)",
                border: `1px solid ${COMPANION_COLORS[companion.id] ?? "#a78bfa"}55`,
                color: COMPANION_COLORS[companion.id] ?? "#a78bfa",
              }}
            >
              {bubbleMsg}
            </motion.div>
          )}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
            style={{
              background: `radial-gradient(circle, ${COMPANION_COLORS[companion.id] ?? "#a78bfa"}cc, ${COMPANION_COLORS[companion.id] ?? "#a78bfa"}44)`,
              boxShadow: `0 0 20px ${COMPANION_COLORS[companion.id] ?? "#a78bfa"}55`,
              border: `2px solid ${COMPANION_COLORS[companion.id] ?? "#a78bfa"}66`,
            }}
          >
            {COMPANION_EMOJIS[companion.id] ?? "⭐"}
          </motion.div>
        </div>
      )}
    </div>
  );
}
