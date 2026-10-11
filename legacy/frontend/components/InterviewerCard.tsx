"use client";

import { motion, AnimatePresence } from "framer-motion";
import SpeakingIndicator from "./SpeakingIndicator";

export interface GDInterviewer {
  id: string;
  name: string;
  title: string;
  gender: "male" | "female";
  color: string;
  bgColor: string;
  initials: string;
  isSpeaking: boolean;
}

interface InterviewerCardProps {
  interviewer: GDInterviewer;
  currentSpeech?: string;
}

const VIDEO_MAP: Record<"male" | "female", { talk: string; idle: string }> = {
  female: { talk: "/womentalk.mp4", idle: "/womenblink.mp4" },
  male:   { talk: "/mentalk.mp4",   idle: "/menblink.mp4"   },
};

export default function InterviewerCard({ interviewer, currentSpeech }: InterviewerCardProps) {
  const { name, title, gender, color, isSpeaking } = interviewer;
  const videos = VIDEO_MAP[gender];

  return (
    <motion.div
      layout
      className="relative rounded-2xl overflow-hidden select-none"
      style={{
        aspectRatio: "4/3",
        border: `1.5px solid ${isSpeaking ? color : "#ffffff15"}`,
        boxShadow: isSpeaking ? `0 0 30px ${color}55, inset 0 0 20px ${color}22` : "none",
        background: "#000",
      }}
    >
      {/* Idle video (visible when not speaking) */}
      <video
        src={videos.idle}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        style={{ opacity: isSpeaking ? 0 : 1 }}
      />

      {/* Talk video (visible when speaking) */}
      <video
        src={videos.talk}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        style={{ opacity: isSpeaking ? 1 : 0 }}
      />

      {/* Speaking glow overlay */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at center, ${color}22 0%, transparent 70%)` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      {/* Bottom gradient + name overlay */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-bold text-white leading-tight">{name}</p>
            <p className="text-[11px]" style={{ color: `${color}cc` }}>{title}</p>
          </div>
          <AnimatePresence>
            {isSpeaking && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SpeakingIndicator color={color} size="sm" label={false} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {isSpeaking && currentSpeech && (
            <motion.p
              className="text-[10px] text-white/80 italic mt-1 line-clamp-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              &ldquo;{currentSpeech.slice(0, 70)}{currentSpeech.length > 70 ? "…" : ""}&rdquo;
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Moderator badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className="text-[10px] font-bold text-white/60 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
          MODERATOR
        </span>
      </div>
    </motion.div>
  );
}
