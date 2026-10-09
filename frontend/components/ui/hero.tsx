"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { LoginModal } from "@/components/login-modal";

const ShootingStars = dynamic(
  () =>
    import("@/components/shooting-stars").then((m) => ({
      default: m.ShootingStars,
    })),
  { ssr: false }
);

const FEATURES = [
  "HR Questions",
  "Behavioral Mastery",
  "Technical Discussion",
  "Communication & Storytelling",
  "Body Language & Posture",
  "Resume & LinkedIn Optimization",
  "AI Mock Interviews",
  "Group Discussion Simulation",
];

function useStars(count: number) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 0.8,
        duration: `${(Math.random() * 3 + 1.5).toFixed(2)}s`,
        delay: `${(Math.random() * 4).toFixed(2)}s`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}

export function Hero() {
  const [modalOpen, setModalOpen] = useState(false);
  const stars = useStars(140);

  return (
    <>
      {/* Keyframe styles */}
      <style>{`
        @keyframes star-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.08; }
        }
        @keyframes title-glow-pulse {
          0%, 100% { text-shadow: 0 0 30px rgba(96,165,250,0.7), 0 0 70px rgba(96,165,250,0.3), 0 0 120px rgba(139,92,246,0.2); }
          50% { text-shadow: 0 0 50px rgba(96,165,250,0.9), 0 0 100px rgba(96,165,250,0.5), 0 0 160px rgba(139,92,246,0.4); }
        }
        @keyframes btn-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.5), 0 0 50px rgba(99,102,241,0.2), inset 0 0 20px rgba(255,255,255,0.04); }
          50% { box-shadow: 0 0 35px rgba(99,102,241,0.8), 0 0 80px rgba(99,102,241,0.4), inset 0 0 20px rgba(255,255,255,0.08); }
        }
      `}</style>

      <div className="relative h-screen w-full overflow-hidden bg-black">
        {/* ── Background image ── */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/interstellar.jpg')" }}
        />

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/55" />

        {/* Gradient vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

        {/* ── Blinking CSS Stars ── */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          {stars.map((s) => (
            <span
              key={s.id}
              className="absolute rounded-full bg-white"
              style={{
                top: s.top,
                left: s.left,
                width: s.size,
                height: s.size,
                animation: `star-blink ${s.duration} ${s.delay} infinite ease-in-out`,
              }}
            />
          ))}
        </div>

        {/* ── Three.js Shooting Stars ── */}
        <ShootingStars />

        {/* ── Ambient glow orbs ── */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)",
            zIndex: 3,
          }}
        />

        {/* ── Hero Content ── */}
        <div
          className="relative flex h-full flex-col items-center justify-center text-center px-4"
          style={{ zIndex: 10 }}
        >
          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-black text-white uppercase tracking-widest select-none"
            style={{
              fontSize: "clamp(3rem, 10vw, 8rem)",
              letterSpacing: "0.12em",
              animation: "title-glow-pulse 4s ease-in-out infinite",
            }}
          >
            BLACKBOX AI
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.45, ease: "easeOut" }}
            className="mt-5 text-blue-200/90 font-light tracking-wide max-w-2xl"
            style={{ fontSize: "clamp(1rem, 2.4vw, 1.4rem)" }}
          >
            Master Communication.&nbsp; Command Confidence.&nbsp; Conquer Interviews.
          </motion.p>

          {/* Quote */}
          <motion.blockquote
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="mt-5 italic text-white/55 pl-4 max-w-xl"
            style={{
              fontSize: "clamp(0.85rem, 1.6vw, 1.05rem)",
              borderLeft: "2px solid rgba(96,165,250,0.6)",
            }}
          >
            &ldquo;Talent gets noticed. Presence gets hired.&rdquo;
          </motion.blockquote>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.1 }}
            className="mt-8 flex flex-wrap justify-center gap-2.5 max-w-3xl"
          >
            {FEATURES.map((feat, i) => (
              <motion.span
                key={feat}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 1.3 + i * 0.07, ease: "backOut" }}
                className="px-4 py-1.5 rounded-full text-sm font-medium text-blue-100/90 cursor-default transition-all duration-200 hover:text-white"
                style={{
                  background: "rgba(30, 64, 175, 0.18)",
                  border: "1px solid rgba(96,165,250,0.25)",
                  backdropFilter: "blur(4px)",
                  boxShadow: "0 0 0 0 rgba(96,165,250,0)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(30, 64, 175, 0.35)";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(96,165,250,0.55)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 14px rgba(96,165,250,0.25)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(30, 64, 175, 0.18)";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(96,165,250,0.25)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 0 0 rgba(96,165,250,0)";
                }}
              >
                {feat}
              </motion.span>
            ))}
          </motion.div>

          {/* Login button */}
          <motion.button
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2.0 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setModalOpen(true)}
            className="mt-10 px-12 py-4 rounded-full text-white font-semibold tracking-widest uppercase text-sm transition-transform"
            style={{
              background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)",
              animation: "btn-glow 3s ease-in-out infinite",
              border: "1px solid rgba(139,92,246,0.45)",
            }}
          >
            Login
          </motion.button>
        </div>
      </div>

      {/* ── Login Modal ── */}
      <LoginModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}