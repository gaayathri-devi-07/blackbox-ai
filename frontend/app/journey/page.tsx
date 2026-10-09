"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { StarField } from "@/components/star-field";

const JOURNEY_NODES = [
  {
    id: "practice",
    title: "Practice Hub",
    icon: "⭐",
    desc: "Daily Q&A, vocal coaching & mock answers",
    color: "#60a5fa",
    glow: "#2563eb",
    status: "available",
  },
  {
    id: "project",
    title: "Project AI",
    icon: "⭐",
    desc: "AI-guided project walkthroughs & explanations",
    color: "#a78bfa",
    glow: "#7c3aed",
    status: "available",
  },
  {
    id: "mock",
    title: "Mock Interview",
    icon: "⭐",
    desc: "Full AI interview with real-time feedback",
    color: "#34d399",
    glow: "#059669",
    status: "available",
  },
  {
    id: "gd",
    title: "Group Discussion",
    icon: "⭐",
    desc: "Simulate group discussions & leadership skills",
    color: "#f472b6",
    glow: "#db2777",
    status: "available",
  },
  {
    id: "performance",
    title: "Performance Dashboard",
    icon: "⭐",
    desc: "Deep analytics, heatmaps & improvement trends",
    color: "#fbbf24",
    glow: "#d97706",
    status: "available",
  },
  {
    id: "plan",
    title: "Improvement Plan",
    icon: "⭐",
    desc: "Personalized 30/60/90-day roadmap",
    color: "#fb923c",
    glow: "#ea580c",
    status: "available",
  },
];

// SVG curved path connecting nodes in a winding path
function GlowPath({ nodes }: { nodes: { x: number; y: number }[] }) {
  if (nodes.length < 2) return null;
  const pts = nodes.map((n) => `${n.x},${n.y}`);
  const d = nodes.reduce((acc, n, i) => {
    if (i === 0) return `M ${n.x} ${n.y}`;
    const prev = nodes[i - 1];
    const cx = (prev.x + n.x) / 2;
    return acc + ` C ${cx} ${prev.y}, ${cx} ${n.y}, ${n.x} ${n.y}`;
  }, "");

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 3 }}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.8} />
          <stop offset="50%" stopColor="#a78bfa" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#f472b6" stopOpacity={0.8} />
        </linearGradient>
      </defs>
      {/* Glow path */}
      <path d={d} fill="none" stroke="url(#pathGrad)" strokeWidth={3} filter="url(#glow)" strokeDasharray="8 6" strokeLinecap="round" />
      {/* Core path */}
      <path d={d} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeDasharray="8 6" strokeLinecap="round" />
    </svg>
  );
}

export default function JourneyPage() {
  const router = useRouter();
  const [companion, setCompanion] = useState<{ id: string; name: string } | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [completedNodes, setCompletedNodes] = useState<Set<string>>(new Set());

  const COMPANION_EMOJIS: Record<string, string> = {
    luna: "🌙", nova: "⭐", stella: "✨", orion: "🌟", cosmo: "🪐",
  };
  const COMPANION_COLORS: Record<string, string> = {
    luna: "#a78bfa", nova: "#60a5fa", stella: "#f472b6", orion: "#34d399", cosmo: "#fbbf24",
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const c = localStorage.getItem("companion");
      if (c) setCompanion(JSON.parse(c));
    }
  }, []);

  // Winding S-curve node positions (percentage of container)
  const NODE_POSITIONS = [
    { x: 15, y: 82 },
    { x: 38, y: 68 },
    { x: 62, y: 54 },
    { x: 80, y: 38 },
    { x: 55, y: 22 },
    { x: 28, y: 10 },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#020010] text-slate-900 dark:text-white transition-colors duration-300">
      <StarField starCount={280} />

      {/* Nebula */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-purple-900/15 blur-[130px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-6"
        >
          <button
            onClick={() => router.push("/home")}
            className="text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white text-xs flex items-center gap-2 transition-colors"
          >
            ← Back to Dashboard
          </button>
          <div>
            <p className="text-xs tracking-[0.4em] text-purple-400/70 uppercase text-right">Your Journey</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-widest bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
              Journey Path
            </h1>
          </div>
        </motion.div>

        {/* Path + Nodes */}
        <div className="flex-1 relative" style={{ minHeight: 520 }}>
          {/* Render SVG path */}
          <div className="absolute inset-0">
            <svg
              className="w-full h-full pointer-events-none"
              style={{ zIndex: 3 }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <filter id="glow2">
                  <feGaussianBlur stdDeviation="0.8" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="pathGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="33%" stopColor="#a78bfa" />
                  <stop offset="66%" stopColor="#f472b6" />
                  <stop offset="100%" stopColor="#fb923c" />
                </linearGradient>
              </defs>
              {/* Main winding path */}
              <path
                d={`M 15 82 C 26 82, 26 68, 38 68 C 50 68, 50 54, 62 54 C 74 54, 74 38, 80 38 C 86 38, 68 22, 55 22 C 42 22, 28 10, 28 10`}
                fill="none"
                stroke="url(#pathGrad2)"
                strokeWidth={0.8}
                filter="url(#glow2)"
                strokeDasharray="3 2"
                strokeLinecap="round"
              />
              {/* Faint outer glow */}
              <path
                d={`M 15 82 C 26 82, 26 68, 38 68 C 50 68, 50 54, 62 54 C 74 54, 74 38, 80 38 C 86 38, 68 22, 55 22 C 42 22, 28 10, 28 10`}
                fill="none"
                stroke="rgba(139,92,246,0.3)"
                strokeWidth={2.5}
                filter="url(#glow2)"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Nodes */}
          {JOURNEY_NODES.map((node, i) => {
            const pos = NODE_POSITIONS[i];
            const isActive = activeNode === node.id;
            const isCompleted = completedNodes.has(node.id);
            const isAvailable = node.status === "available" || isCompleted;

            return (
              <motion.div
                key={node.id}
                className="absolute"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 10,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.15, type: "spring", stiffness: 200 }}
              >
                {/* Glow ring */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${node.color}30, transparent)`,
                    width: 80,
                    height: 80,
                    left: -16,
                    top: -16,
                  }}
                  animate={isAvailable ? { scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] } : {}}
                  transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* Node button */}
                <motion.button
                  onClick={() => isAvailable && setActiveNode(activeNode === node.id ? null : node.id)}
                  whileHover={isAvailable ? { scale: 1.15 } : {}}
                  whileTap={isAvailable ? { scale: 0.9 } : {}}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
                  className="relative w-12 h-12 rounded-full flex items-center justify-center text-xl"
                  style={{
                    background: isAvailable
                      ? `radial-gradient(circle at 35% 35%, ${node.color}cc, ${node.glow}88)`
                      : "rgba(255,255,255,0.06)",
                    border: isActive
                      ? `2px solid ${node.color}`
                      : isAvailable
                      ? `1.5px solid ${node.color}66`
                      : "1.5px solid rgba(255,255,255,0.12)",
                    boxShadow: isActive
                      ? `0 0 30px ${node.glow}88`
                      : isAvailable
                      ? `0 0 15px ${node.color}44`
                      : "none",
                    cursor: isAvailable ? "pointer" : "default",
                    filter: isAvailable ? "none" : "grayscale(0.8) opacity(0.4)",
                  }}
                >
                  <span>{node.icon}</span>
                  {!isAvailable && (
                    <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40">
                      <span className="text-[10px]">🔒</span>
                    </div>
                  )}
                </motion.button>

                {/* Label */}
                <div
                  className="absolute text-center pointer-events-none"
                  style={{
                    width: 100,
                    left: "50%",
                    transform: "translateX(-50%)",
                    top: 52,
                  }}
                >
                  <p
                    className="text-[10px] font-bold leading-tight"
                    style={{ color: isAvailable ? node.color : "rgba(255,255,255,0.25)" }}
                  >
                    {node.title}
                  </p>
                </div>

                {/* Popup card */}
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="absolute z-30 rounded-2xl p-4 text-left"
                    style={{
                      width: 200,
                      left: "50%",
                      top: -140,
                      transform: "translateX(-50%)",
                      background: "rgba(5,2,20,0.92)",
                      backdropFilter: "blur(20px)",
                      border: `1px solid ${node.color}55`,
                      boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${node.glow}33`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{node.icon}</span>
                      <h3 className="text-xs font-bold" style={{ color: node.color }}>
                        {node.title}
                      </h3>
                    </div>
                      <p className="text-[10px] text-slate-600 dark:text-white/50 mb-3 leading-relaxed">{node.desc}</p>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (node.id === "mock") router.push("/interview/setup");
                        else if (node.id === "performance") router.push("/home");
                        else if (node.id === "gd") router.push("/gd-room");
                        else router.push(`/journey/${node.id}`);
                      }}
                      className="w-full py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        background: `linear-gradient(135deg, ${node.color}44, ${node.glow}44)`,
                        border: `1px solid ${node.color}55`,
                        color: node.color,
                      }}
                    >
                      Enter →
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex items-center justify-center gap-6 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-2 text-[10px] text-white/40">
            <div className="w-3 h-3 rounded-full bg-blue-400/60" />
            Available
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/40">
            <div className="w-3 h-3 rounded-full bg-white/10" />
            Locked
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/40">
            <div className="w-3 h-3 rounded-full bg-green-400/60" />
            Completed
          </div>
        </motion.div>
      </div>

      {/* Floating companion */}
      {companion && (
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center text-xl"
          style={{
            background: `radial-gradient(circle, ${COMPANION_COLORS[companion.id] ?? "#a78bfa"}cc, transparent)`,
            boxShadow: `0 0 20px ${COMPANION_COLORS[companion.id] ?? "#a78bfa"}55`,
            border: `2px solid ${COMPANION_COLORS[companion.id] ?? "#a78bfa"}66`,
          }}
        >
          {COMPANION_EMOJIS[companion.id] ?? "⭐"}
        </motion.div>
      )}
    </div>
  );
}
