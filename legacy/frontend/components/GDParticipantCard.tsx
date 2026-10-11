"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import SpeakingIndicator from "./SpeakingIndicator";

export type ParticipantStatus = "idle" | "hand-raised" | "speaking";

export interface GDParticipant {
  id: string;
  name: string;
  personalityLabel: string;
  initials: string;
  color: string;
  bgColor: string;
  status: ParticipantStatus;
  speakingCount: number;
}

interface GDParticipantCardProps {
  participant: GDParticipant;
  isUser?: boolean;
  currentText?: string;
  videoSrc?: string;      // for AI participants
  stream?: MediaStream;   // for user camera
  activeSpeakerId?: string;
}

export default function GDParticipantCard({
  participant,
  isUser = false,
  currentText,
  videoSrc,
  stream,
  activeSpeakerId = "none",
}: GDParticipantCardProps) {
  const { name, personalityLabel, initials, color, bgColor, status, speakingCount } = participant;
  const isSpeaking = status === "speaking";
  const isHandRaised = status === "hand-raised";
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach camera stream for the user tile
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Strict talking-stick behavior for AI videos:
  // play only for the active speaker, otherwise freeze on the current frame.
  useEffect(() => {
    if (isUser || !videoSrc || !videoRef.current) return;
    const video = videoRef.current;
    if (activeSpeakerId === participant.id) {
      video.play().catch((e) => console.error(e));
    } else {
      video.pause();
    }
  }, [activeSpeakerId, participant.id, videoSrc, isUser]);

  const hasVideo = !!videoSrc || (isUser && !!stream);

  return (
    <motion.div
      layout
      className="relative rounded-2xl overflow-hidden select-none"
      style={{
        aspectRatio: "4/3",
        background: hasVideo ? "#000" : `linear-gradient(145deg, ${bgColor}, #0a0015)`,
        border: `1.5px solid ${isSpeaking ? color : isHandRaised ? "#f59e0b" : "#ffffff10"}`,
        boxShadow: isSpeaking
          ? `0 0 28px ${color}55, inset 0 0 20px ${color}22`
          : isHandRaised
          ? "0 0 16px #f59e0b44"
          : "none",
      }}
      animate={isSpeaking ? { scale: [1, 1.012, 1] } : { scale: 1 }}
      transition={{ duration: 1, repeat: isSpeaking ? Infinity : 0 }}
    >
      {/* Speaking glow pulse */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-10"
            style={{ background: `radial-gradient(ellipse at center, ${color}22 0%, transparent 70%)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      {/* AI video (loops) */}
      {videoSrc && !isUser && (
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          loop
          playsInline
          preload="auto"
          onLoadedData={() => {
            if (activeSpeakerId === participant.id) videoRef.current?.play().catch((e) => console.error(e));
          }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* User camera stream */}
      {isUser && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
      )}

      {/* Fallback avatar when no video available */}
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${color}cc, ${color}66)` }}
            animate={isSpeaking ? { boxShadow: [`0 0 0px ${color}`, `0 0 20px ${color}`, `0 0 0px ${color}`] } : {}}
            transition={{ duration: 1, repeat: isSpeaking ? Infinity : 0 }}
          >
            {isUser ? "👤" : initials}
          </motion.div>
        </div>
      )}

      {/* Bottom gradient + name overlay */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-2.5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-bold text-white leading-tight">{name}</p>
            <p className="text-[11px] font-medium" style={{ color: `${color}cc` }}>
              {isUser ? "You" : personalityLabel}
            </p>
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
          {isSpeaking && currentText && (
            <motion.p
              className="text-[10px] text-white/80 italic mt-1 line-clamp-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              &ldquo;{currentText}&rdquo;
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Hand raise badge */}
      <AnimatePresence>
        {isHandRaised && (
          <motion.div
            className="absolute top-2 left-1/2 -translate-x-1/2 z-30 text-xl"
            initial={{ scale: 0, y: 4 }}
            animate={{ scale: 1, y: [0, -4, 0] }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.3, y: { duration: 0.8, repeat: Infinity } }}
          >
            ✋
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-queue tag */}
      {isHandRaised && (
        <span className="absolute top-2 right-2 z-30 text-[10px] font-semibold text-amber-400 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
          In queue
        </span>
      )}

      {/* Speaking count badge */}
      {speakingCount > 0 && !isSpeaking && !isHandRaised && (
        <span
          className="absolute top-2 left-2 z-30 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: `${color}44`, color, backdropFilter: "blur(4px)" }}
        >
          ×{speakingCount}
        </span>
      )}
    </motion.div>
  );
}


