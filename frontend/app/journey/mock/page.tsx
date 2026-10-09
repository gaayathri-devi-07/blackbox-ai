"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { CosmicLayout, FloatingCompanion } from "@/components/use-companion";

// ── Real company SVG logos ──────────────────────────────────────────────────────
function CompanyLogo({ id, size = 36 }: { id: string; size?: number }) {
  if (id === "google") return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7z"/>
    </svg>
  );
  if (id === "amazon") return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <text x="5" y="34" fontSize="30" fontWeight="bold" fill="#FF9900" fontFamily="Arial,sans-serif">a</text>
      <path d="M8 39 Q24 47 40 39" stroke="#FF9900" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
      <path d="M37 36 L41 40 L36 41" fill="#FF9900"/>
    </svg>
  );
  if (id === "microsoft") return (
    <svg width={size} height={size} viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
  if (id === "meta") return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#0668E1" d="M24 14c-3.5 0-6.3 1.6-8.5 4.2C13.3 20.8 12 24.2 12 28c0 2.2.5 4 1.4 5.3.9 1.3 2.2 2 3.8 2 1.4 0 2.6-.5 3.8-1.6 1.2-1.1 2.4-2.9 3.8-5.6l.7-1.3.7 1.3c1.4 2.7 2.6 4.5 3.8 5.6 1.2 1.1 2.4 1.6 3.8 1.6 1.6 0 2.9-.7 3.8-2 .9-1.3 1.4-3.1 1.4-5.3 0-3.8-1.3-7.2-3.5-9.8C33.3 15.6 30.5 14 27 14h-3zm-3 2h3c3 0 5.3 1.3 7.1 3.5 1.8 2.2 2.9 5.2 2.9 8.5 0 1.8-.4 3.1-1 4-.5.8-1.2 1.3-2.2 1.3-.9 0-1.8-.4-2.8-1.3-1-.9-2.1-2.5-3.4-5.1l-1.6-3-1.6 3c-1.3 2.6-2.4 4.2-3.4 5.1-1 .9-1.9 1.3-2.8 1.3-1 0-1.7-.5-2.2-1.3-.6-.9-1-2.2-1-4 0-3.3 1.1-6.3 2.9-8.5C17.7 17.3 20 16 23 16z"/>
    </svg>
  );
  // Startup — rocket icon
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#a78bfa" d="M24 4c0 0-10 8-10 20h4l-4 8h6v8l4-4 4 4v-8h6l-4-8h4C34 12 24 4 24 4z"/>
      <circle cx="24" cy="20" r="3" fill="#fff" opacity="0.9"/>
    </svg>
  );
}

const COMPANIES = [
  {
    id: "google",
    name: "Google",
    logo: "🔵",
    color: "#4285F4",
    glow: "#2563eb",
    style: "Analytical & Structured",
    focus: ["System Design", "Algorithms", "Behavioral (STAR)"],
    difficulty: "Hard",
    desc: "Google interviews focus on deep algorithmic thinking, system design at scale, and structured problem-solving. Expect data structures, scalability questions, and STAR-format behavioral rounds.",
    tip: "Think out loud. They care about your process more than the perfect answer.",
  },
  {
    id: "amazon",
    name: "Amazon",
    logo: "🟠",
    color: "#FF9900",
    glow: "#d97706",
    style: "Leadership Principles",
    focus: ["14 Leadership Principles", "STAR method", "Ownership & Impact"],
    difficulty: "Hard",
    desc: "Amazon is deeply behavioral. Every answer must connect to one of their 14 Leadership Principles. Expect 'Tell me about a time...' for every single question.",
    tip: "Prepare 8-10 anchor stories. Tag each story to multiple Leadership Principles.",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    logo: "🪟",
    color: "#00A4EF",
    glow: "#0284c7",
    style: "Growth Mindset",
    focus: ["Collaboration", "Learning agility", "Technical breadth"],
    difficulty: "Medium",
    desc: "Microsoft values growth mindset, collaboration, and technical depth. They look for candidates who learn from failure and work well across teams.",
    tip: "Talk about learning from mistakes. Show curiosity and collaboration.",
  },
  {
    id: "meta",
    name: "Meta",
    logo: "🔷",
    color: "#0668E1",
    glow: "#1d4ed8",
    style: "Product & Data-Driven",
    focus: ["Product sense", "Metrics & impact", "Scale (billions of users)"],
    difficulty: "Hard",
    desc: "Meta focuses on building at massive scale, product intuition, and data-driven decisions. They want engineers who think like product owners.",
    tip: "Always frame answers around metrics and impact. How does it affect billions of users?",
  },
  {
    id: "startup",
    name: "Startup",
    logo: "🚀",
    color: "#a78bfa",
    glow: "#7c3aed",
    style: "Versatile & Fast",
    focus: ["Ownership", "Execution speed", "Cultural fit"],
    difficulty: "Medium",
    desc: "Startups care about versatility, ownership, and moving fast. They need people who wear multiple hats, handle ambiguity, and can build from scratch.",
    tip: "Show initiative. Talk about things you built independently without being asked.",
  },
];

const DIFFICULTY_COLORS: Record<string, string> = { Easy: "#34d399", Medium: "#fbbf24", Hard: "#f87171" };

export default function MockSelect() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const selectedCompany = COMPANIES.find((c) => c.id === selected);

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
          <button onClick={() => router.push("/journey")} className="text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white text-xs transition-colors">
            ← Journey
          </button>
          <div className="text-center">
            <p className="text-[10px] tracking-[0.4em] text-green-400/70 uppercase mb-0.5">Mock Interview</p>
            <h1 className="text-xl font-extrabold tracking-widest bg-gradient-to-r from-green-300 to-blue-300 bg-clip-text text-transparent">
              Choose Your Company
            </h1>
          </div>
          <div className="text-xs text-slate-500 dark:text-white/30">{COMPANIES.length} companies</div>
        </motion.div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: company grid */}
          <div className="flex-1 px-6 py-6 overflow-y-auto">
            <p className="text-xs text-slate-500 dark:text-white/40 mb-5 text-center">
              Each company has a unique interview style. Choose one to simulate their real interview experience.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {COMPANIES.map((c, i) => (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => setSelected(c.id)}
                  onMouseEnter={() => setHovered(c.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="text-left rounded-2xl p-5 transition-all"
                  style={{
                    background:
                      selected === c.id
                        ? `${c.color}22`
                        : hovered === c.id
                        ? "rgba(255,255,255,0.07)"
                        : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${selected === c.id ? c.color + "88" : hovered === c.id ? c.color + "44" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: selected === c.id ? `0 0 30px ${c.glow}33` : "none",
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <CompanyLogo id={c.id} size={36} />
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</h3>
                        <p className="text-[10px]" style={{ color: c.color }}>{c.style}</p>
                      </div>
                    </div>
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: `${DIFFICULTY_COLORS[c.difficulty]}22`, color: DIFFICULTY_COLORS[c.difficulty], border: `1px solid ${DIFFICULTY_COLORS[c.difficulty]}44` }}
                    >
                      {c.difficulty}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-white/50 mb-3 leading-relaxed">{c.desc}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {c.focus.map((f) => (
                      <span
                        key={f}
                        className="text-[9px] px-2 py-0.5 rounded-full"
                        style={{ background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}33` }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  {selected === c.id && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center bg-green-400 text-black text-[8px] font-black">✓</div>
                      <span className="text-[10px] text-green-400 font-semibold">Selected</span>
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Right: detail + tip */}
          <div
            className="w-[280px] flex flex-col px-5 py-6"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
          >
            {selectedCompany ? (
              <motion.div
                key={selectedCompany.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col gap-4"
              >
                <div className="text-center">
                  <span className="text-5xl">{selectedCompany.logo}</span>
                  <h2 className="text-lg font-bold mt-2" style={{ color: selectedCompany.color }}>
                    {selectedCompany.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-white/40 mt-1">{selectedCompany.style}</p>
                </div>

                <div
                  className="rounded-xl p-4"
                  style={{ background: `${selectedCompany.color}15`, border: `1px solid ${selectedCompany.color}33` }}
                >
                  <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2">💡 Pro Tip</p>
                  <p className="text-xs text-slate-700 dark:text-white/70 leading-relaxed">{selectedCompany.tip}</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2">Focus Areas</p>
                  <div className="space-y-1.5">
                    {selectedCompany.focus.map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: selectedCompany.color }} />
                        <span className="text-xs text-slate-700 dark:text-white/60">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2">What to Expect</p>
                  <ul className="space-y-1 text-[11px] text-slate-600 dark:text-white/50">
                    <li>• 5 interview questions</li>
                    <li>• AI interviewer with {selectedCompany.name} style</li>
                    <li>• Real-time companion coaching</li>
                    <li>• Full performance report at end</li>
                  </ul>
                </div>

                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push(`/journey/mock/${selectedCompany.id}`)}
                  className="w-full py-3.5 rounded-2xl text-sm font-black tracking-widest uppercase mt-2"
                  style={{
                    background: `linear-gradient(135deg, ${selectedCompany.color}, ${selectedCompany.glow})`,
                    boxShadow: `0 0 30px ${selectedCompany.glow}44`,
                    border: `1px solid ${selectedCompany.color}66`,
                  }}
                >
                  Start Interview →
                </motion.button>
              </motion.div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <p className="text-4xl mb-3">🎯</p>
                  <p className="text-sm text-slate-500 dark:text-white/40">Select a company to see its interview style and tips</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <FloatingCompanion />
    </CosmicLayout>
  );
}
