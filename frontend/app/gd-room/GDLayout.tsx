"use client";

import { motion } from "framer-motion";
import InterviewerCard, { GDInterviewer } from "@/components/InterviewerCard";
import GDParticipantCard, { GDParticipant } from "@/components/GDParticipantCard";
import HandRaiseButton from "@/components/HandRaiseButton";

interface GDLayoutProps {
  interviewers: GDInterviewer[];
  participants: GDParticipant[];
  topic: string;
  phase: "lobby" | "discussing" | "ended";
  moderatorSpeech: string;
  handQueue: string[];
  userHandRaised: boolean;
  userIsSpeaking: boolean;
  currentSpeakerText: Record<string, string>;
  onUserHandRaise: () => void;
  onUserDoneSpeaking: () => void;
  transcript: Array<{ speakerId: string; speakerName: string; text: string; color: string; timestamp: number }>;
  isTTSEnabled: boolean;
  onToggleTTS: () => void;
  userStream?: MediaStream | null;
  currentSpeaker: string;
  isDiscussionActive: boolean;
}

const AI_VIDEO_MAP: Record<string, string> = {
  ai1: "/ai1.mp4",
  ai2: "/ai2.mp4",
  ai3: "/ai3.mp4",
  ai4: "/ai4.mp4",
};

export default function GDLayout({
  interviewers,
  participants,
  topic,
  phase,
  moderatorSpeech,
  handQueue,
  userHandRaised,
  userIsSpeaking,
  currentSpeakerText,
  onUserHandRaise,
  onUserDoneSpeaking,
  transcript,
  isTTSEnabled,
  onToggleTTS,
  userStream,
  currentSpeaker,
  isDiscussionActive,
}: GDLayoutProps) {
  const userParticipant: GDParticipant = {
    id: "user",
    name: "You",
    personalityLabel: "Participant",
    initials: "U",
    color: "#06b6d4",
    bgColor: "#001a20",
    status: userIsSpeaking ? "speaking" : userHandRaised ? "hand-raised" : "idle",
    speakingCount: 0,
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full h-full">
      {/* ── Left: Video grid ── */}
      <div className="flex flex-col gap-3 flex-1">

        {/* Topic banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center px-4 py-3 rounded-xl"
          style={{ background: "linear-gradient(135deg, #1a0040, #0d0020)", border: "1px solid #7c3aed33" }}
        >
          <p className="text-xs text-purple-400 font-semibold uppercase tracking-widest mb-1">Discussion Topic</p>
          <p className="text-sm font-bold text-white leading-tight">{topic || "Waiting for topic…"}</p>
        </motion.div>

        {/* Moderator speech bar */}
        {moderatorSpeech && (
          <motion.div
            key={moderatorSpeech}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 px-4 py-2.5 rounded-xl"
            style={{ background: "#0d001f", border: "1px solid #7c3aed55" }}
          >
            <span className="text-purple-400 text-lg mt-0.5">🎙️</span>
            <p className="text-sm text-white/80 italic leading-snug">&ldquo;{moderatorSpeech}&rdquo;</p>
          </motion.div>
        )}

        {/* ── Row 1: Interviewers ── */}
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 px-1">Interviewers</p>
          <div className="grid grid-cols-2 gap-3">
            {interviewers.map((iv) => (
              <InterviewerCard key={iv.id} interviewer={iv} currentSpeech={moderatorSpeech} />
            ))}
          </div>
        </div>

        {/* ── Row 2+3: AI Participants ── */}
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 px-1">AI Candidates</p>
          <div className="grid grid-cols-2 gap-3">
            {participants.map((p) => (
              <GDParticipantCard
                key={p.id}
                participant={p}
                videoSrc={AI_VIDEO_MAP[p.id]}
                currentText={currentSpeakerText[p.id]}
                activeSpeakerId={currentSpeaker}
              />
            ))}
          </div>
        </div>

        {/* ── Row 4: User ── */}
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 px-1">You</p>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <GDParticipantCard participant={userParticipant} isUser stream={userStream ?? undefined} />
            </div>
            <div className="flex flex-col gap-2">
              {phase === "discussing" && (
                <>
                  <HandRaiseButton
                    raised={userHandRaised}
                    onClick={onUserHandRaise}
                    disabled={userHandRaised || userIsSpeaking}
                  />
                  {userIsSpeaking && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={onUserDoneSpeaking}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, #dc2626, #991b1b)" }}
                    >
                      ✓ Done Speaking
                    </motion.button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Queue info */}
      {handQueue.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#1a0a00", border: "1px solid #f59e0b33" }}>
            <span className="text-amber-400 text-sm">Queue:</span>
            <div className="flex gap-1.5">
              {handQueue.map((id, i) => {
                const p = participants.find((x) => x.id === id);
                const label = id === "user" ? "You" : (p?.name.split(" ")[0] ?? id);
                return (
                  <span
                    key={id}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: p ? `${p.color}22` : "#06b6d422", color: p?.color ?? "#06b6d4" }}
                  >
                    {i + 1}. {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {isDiscussionActive && handQueue[0] === "user" && (
          <div className="px-3 py-2 rounded-lg text-xs text-cyan-200 border border-cyan-400/30 bg-cyan-500/10">
            ✅ Your hand is raised — you are next in queue.
          </div>
        )}
      </div>

      {/* ── Right: Transcript + Controls ── */}
      <div className="lg:w-80 flex flex-col gap-3">
        {/* TTS toggle */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "#0d001f", border: "1px solid #ffffff10" }}>
          <span className="text-xs text-white/50">Voice (TTS)</span>
          <button
            onClick={onToggleTTS}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
            style={{
              background: isTTSEnabled ? "#7c3aed33" : "#ffffff10",
              color: isTTSEnabled ? "#a78bfa" : "#ffffff40",
              border: `1px solid ${isTTSEnabled ? "#7c3aed55" : "#ffffff10"}`,
            }}
          >
            {isTTSEnabled ? "🔊 ON" : "🔇 OFF"}
          </button>
        </div>

        {/* Transcript */}
        <div
          className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[520px] pr-1"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#7c3aed33 transparent" }}
        >
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1">Transcript</p>
          {transcript.length === 0 && (
            <p className="text-xs text-white/25 italic px-1">Discussion will appear here…</p>
          )}
          {transcript.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="px-3 py-2 rounded-xl"
              style={{ background: `${msg.color}11`, border: `1px solid ${msg.color}33` }}
            >
              <p className="text-[11px] font-bold mb-1" style={{ color: msg.color }}>
                {msg.speakerName}
              </p>
              <p className="text-xs text-white/75 leading-relaxed">{msg.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
