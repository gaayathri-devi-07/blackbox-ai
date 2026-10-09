"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { StarField } from "@/components/star-field";
import { useUserStore } from "@/lib/userStore";
import { updateUserProfile } from "@/lib/firestore";

const COMPANIONS = [
  {
    id: "luna",
    defaultName: "Luna",
    color: "#a78bfa",
    glow: "#7c3aed",
    emoji: "🌙",
    trait: "Calm & Wise",
    messages: ["You can do this!! 💜", "Remember to smile 😊", "Sit up straight!", "You're amazing!", "Make eye contact!"],
  },
  {
    id: "nova",
    defaultName: "Nova",
    color: "#60a5fa",
    glow: "#2563eb",
    emoji: "⭐",
    trait: "Energetic & Bold",
    messages: ["Crush it today!! 💙", "Don't forget to smile 😄", "Stand tall!", "Believe in yourself!", "Look them in the eyes!"],
  },
  {
    id: "stella",
    defaultName: "Stella",
    color: "#f472b6",
    glow: "#db2777",
    emoji: "✨",
    trait: "Warm & Encouraging",
    messages: ["You've got this!! 💖", "Smile bright ✨", "Perfect posture!", "You're brilliant!", "Eye contact = confidence!"],
  },
  {
    id: "orion",
    defaultName: "Orion",
    color: "#34d399",
    glow: "#059669",
    emoji: "🌟",
    trait: "Strategic & Sharp",
    messages: ["Stay focused!! 💚", "Keep smiling 😎", "Shoulders back!", "Trust your prep!", "Connect with your eyes!"],
  },
  {
    id: "cosmo",
    defaultName: "Cosmo",
    color: "#fbbf24",
    glow: "#d97706",
    emoji: "🪐",
    trait: "Playful & Creative",
    messages: ["You're a star!! 💛", "Flash that smile 🌟", "Head high!", "Radiate confidence!", "Gaze with purpose!"],
  },
];

function CompanionAvatar({ companion, size = 80 }: { companion: typeof COMPANIONS[0]; size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 35%, ${companion.color}cc, ${companion.glow}88)`,
        boxShadow: `0 0 ${size * 0.4}px ${companion.color}66, 0 0 ${size * 0.15}px ${companion.color}44 inset`,
        border: `2px solid ${companion.color}88`,
      }}
    >
      <span style={{ fontSize: size * 0.42 }}>{companion.emoji}</span>
    </div>
  );
}

export default function CompanionPage() {
  const router = useRouter();
  const { profile, setProfile } = useUserStore();
  const [names, setNames] = useState<Record<string, string>>(
    Object.fromEntries(COMPANIONS.map((c) => [c.id, c.defaultName]))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(profile?.companionId || null);
  const [bubbleMsg, setBubbleMsg] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const radius = 200;

  useEffect(() => {
    if (!selectedId) return;
    const companion = COMPANIONS.find((c) => c.id === selectedId)!;
    const cycle = () => {
      const msg = companion.messages[Math.floor(Math.random() * companion.messages.length)];
      setBubbleMsg(msg);
      setShowBubble(true);
      msgTimerRef.current = setTimeout(() => {
        setShowBubble(false);
        msgTimerRef.current = setTimeout(cycle, 3500);
      }, 3200);
    };
    msgTimerRef.current = setTimeout(cycle, 1000);
    return () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current); };
  }, [selectedId]);

  const handleContinue = async () => {
    if (selectedId && profile?.uid) {
      setIsSaving(true);
      try {
        // Save to Firebase
        await updateUserProfile(profile.uid, { companionId: selectedId });
        
        // Update Zustand
        setProfile({ ...profile, companionId: selectedId });
        
        // Also save to localStorage for backward compatibility
        if (typeof window !== "undefined") {
          localStorage.setItem("companion", JSON.stringify({ id: selectedId, name: names[selectedId] }));
        }
        
        // Route to career selection
        router.push("/career");
      } catch (error) {
        console.error("Failed to save companion:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#020010] text-slate-900 dark:text-white transition-colors duration-300">
      <StarField starCount={250} />

      {/* Nebula glows */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-900/20 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-900/20 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen py-10 px-4">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <p className="text-xs tracking-[0.4em] text-purple-400/80 uppercase mb-3">Step 1 of 2</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-widest bg-gradient-to-r from-purple-300 via-blue-200 to-pink-300 bg-clip-text text-transparent">
            Choose Your AI Companion
          </h1>
          <p className="mt-3 text-slate-500 dark:text-white/40 text-sm tracking-wide">
            Your companion motivates, reminds, and boosts your confidence
          </p>
        </motion.div>

        {/* Orbital layout */}
        <div
          className="relative"
          style={{ width: radius * 2 + 140, height: radius * 2 + 140 }}
        >
          {/* Orbit ring */}
          <div
            className="absolute rounded-full border border-white/[0.06]"
            style={{ width: radius * 2, height: radius * 2, left: 70, top: 70 }}
          />
          <div
            className="absolute rounded-full border border-white/[0.03]"
            style={{ width: radius * 2 - 30, height: radius * 2 - 30, left: 85, top: 85 }}
          />

          {COMPANIONS.map((companion, i) => {
            const angleDeg = -90 + (360 / COMPANIONS.length) * i;
            const angleRad = (angleDeg * Math.PI) / 180;
            const cx = Math.cos(angleRad) * radius + radius + 70;
            const cy = Math.sin(angleRad) * radius + radius + 70;
            const isSelected = selectedId === companion.id;

            return (
              <motion.div
                key={companion.id}
                className="absolute flex flex-col items-center"
                style={{ left: cx - 55, top: cy - 55, width: 110 }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 180 }}
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
                  className="cursor-pointer relative"
                  onClick={() => setSelectedId(companion.id)}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.93 }}
                >
                  {isSelected && (
                    <motion.div
                      className="absolute -inset-3 rounded-full"
                      style={{ background: `radial-gradient(circle, ${companion.color}30, transparent)` }}
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    />
                  )}
                  <CompanionAvatar companion={companion} size={isSelected ? 88 : 70} />
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-black flex items-center justify-center shadow-lg"
                    >
                      <span className="text-[9px] font-bold">✓</span>
                    </motion.div>
                  )}
                </motion.div>

                {/* Editable name */}
                <div className="mt-2 text-center">
                  {editingId === companion.id ? (
                    <input
                      autoFocus
                      className="bg-white/10 border border-white/30 rounded-lg px-2 py-0.5 text-xs text-white text-center w-22 outline-none focus:border-purple-400"
                      style={{ width: 88 }}
                      value={names[companion.id]}
                      onChange={(e) => setNames((prev) => ({ ...prev, [companion.id]: e.target.value }))}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                    />
                  ) : (
                    <button
                      className="text-xs font-semibold tracking-wide transition-colors group"
                      style={{ color: isSelected ? companion.color : "rgba(255,255,255,0.75)" }}
                      onClick={(e) => { e.stopPropagation(); setEditingId(companion.id); }}
                      title="Click to rename"
                    >
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] mr-0.5">✏️</span>
                      {names[companion.id]}
                    </button>
                  )}
                  <p className="text-[9px] text-white/35 mt-0.5">{companion.trait}</p>
                </div>
              </motion.div>
            );
          })}

          {/* Center */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              width: 110,
              height: 110,
              left: radius + 70 - 55,
              top: radius + 70 - 55,
            }}
          >
            {selectedId ? (
              <motion.div
                key={selectedId}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <CompanionAvatar companion={COMPANIONS.find((c) => c.id === selectedId)!} size={52} />
                <p
                  className="text-[10px] mt-1 font-semibold"
                  style={{ color: COMPANIONS.find((c) => c.id === selectedId)?.color }}
                >
                  {names[selectedId]}
                </p>
              </motion.div>
            ) : (
              <p className="text-[10px] text-white/25 text-center leading-relaxed">Choose<br />your guide</p>
            )}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8"
        >
          <motion.button
            whileHover={selectedId && !isSaving ? { scale: 1.06 } : {}}
            whileTap={selectedId && !isSaving ? { scale: 0.97 } : {}}
            onClick={handleContinue}
            disabled={!selectedId || isSaving}
            className="px-12 py-4 rounded-full text-sm font-bold tracking-widest uppercase transition-all duration-300"
            style={{
              background: selectedId
                ? `linear-gradient(135deg, ${COMPANIONS.find((c) => c.id === selectedId)?.color}, #3b82f6)`
                : "rgba(255,255,255,0.08)",
              border: `1px solid ${selectedId ? COMPANIONS.find((c) => c.id === selectedId)?.color + "88" : "rgba(255,255,255,0.15)"}`,
              cursor: selectedId && !isSaving ? "pointer" : "not-allowed",
              color: selectedId ? "#fff" : "rgba(255,255,255,0.3)",
              boxShadow: selectedId
                ? `0 0 40px ${COMPANIONS.find((c) => c.id === selectedId)?.glow}55`
                : "none",
            }}
          >
            {isSaving ? "Saving..." : selectedId ? "Continue to Career Path →" : "Select a Companion First"}
          </motion.button>
        </motion.div>
      </div>

      {/* Floating mini companion */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0, scale: 0, x: 20, y: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
          >
            <AnimatePresence>
              {showBubble && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 6 }}
                  className="relative max-w-[170px] rounded-2xl rounded-br-sm px-3 py-2 text-[11px] text-center font-semibold shadow-xl"
                  style={{
                    background: "rgba(10,5,30,0.85)",
                    backdropFilter: "blur(20px)",
                    border: `1px solid ${COMPANIONS.find((c) => c.id === selectedId)?.color}55`,
                    color: COMPANIONS.find((c) => c.id === selectedId)?.color,
                  }}
                >
                  {bubbleMsg}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <CompanionAvatar
                companion={COMPANIONS.find((c) => c.id === selectedId)!}
                size={54}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
