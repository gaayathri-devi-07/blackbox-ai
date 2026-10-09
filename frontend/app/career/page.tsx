"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { StarField } from "@/components/star-field";
import { useUserStore } from "@/lib/userStore";
import { updateUserProfile } from "@/lib/firestore";

const CAREERS = [
  {
    id: "software-dev",
    title: "Software Developer",
    icon: "💻",
    color: "#60a5fa",
    glow: "#2563eb",
    desc: "Build products that change the world",
    skills: ["Algorithms", "System Design", "DSA", "OOP"],
  },
  {
    id: "ai-ml",
    title: "AI / ML Engineer",
    icon: "🤖",
    color: "#a78bfa",
    glow: "#7c3aed",
    desc: "Train models that think and learn",
    skills: ["Deep Learning", "PyTorch", "NLP", "MLOps"],
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    icon: "📊",
    color: "#34d399",
    glow: "#059669",
    desc: "Turn raw data into real insights",
    skills: ["Statistics", "Python", "SQL", "Visualization"],
  },
  {
    id: "cloud-engineer",
    title: "Cloud Engineer",
    icon: "☁️",
    color: "#fbbf24",
    glow: "#d97706",
    desc: "Architect scalable cloud infrastructure",
    skills: ["AWS/GCP/Azure", "Kubernetes", "Terraform", "CI/CD"],
  },
  {
    id: "product-analyst",
    title: "Product Analyst",
    icon: "🎯",
    color: "#f472b6",
    glow: "#db2777",
    desc: "Drive product strategy with data",
    skills: ["Analytics", "A/B Testing", "SQL", "Stakeholder Mgmt"],
  },
];

export default function CareerPage() {
  const router = useRouter();
  const { profile, setProfile } = useUserStore();
  const [rotation, setRotation] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(profile?.careerPath || null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const lastY = useRef(0);
  const lastX = useRef(0);
  const velocityRef = useRef(0);
  const animRef = useRef<number | null>(null);

  const totalCards = CAREERS.length;
  const radius = 280;

  // Momentum / inertia scroll
  const applyMomentum = useCallback(() => {
    velocityRef.current *= 0.93;
    if (Math.abs(velocityRef.current) > 0.05) {
      setRotation((r) => r + velocityRef.current);
      animRef.current = requestAnimationFrame(applyMomentum);
    }
  }, []);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Mouse wheel rotation
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * 0.08;
    velocityRef.current = delta;
    setRotation((r) => r + delta);
  }, []);

  // Drag rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastX.current = e.clientX;
    lastY.current = e.clientY;
    if (animRef.current) cancelAnimationFrame(animRef.current);
  };
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX.current;
    velocityRef.current = dx * 0.2;
    setRotation((r) => r + dx * 0.2);
    lastX.current = e.clientX;
  }, [isDragging]);
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    animRef.current = requestAnimationFrame(applyMomentum);
  }, [applyMomentum]);

  // Touch drag
  const handleTouchStart = (e: React.TouchEvent) => {
    lastX.current = e.touches[0].clientX;
    if (animRef.current) cancelAnimationFrame(animRef.current);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - lastX.current;
    velocityRef.current = dx * 0.2;
    setRotation((r) => r + dx * 0.2);
    lastX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    animRef.current = requestAnimationFrame(applyMomentum);
  };

  const handleContinue = async () => {
    if (selectedId && profile?.uid) {
      setIsSaving(true);
      try {
        // Save to Firebase
        await updateUserProfile(profile.uid, { 
          careerPath: selectedId,
          onboardingComplete: true 
        });
        
        // Update Zustand
        setProfile({ ...profile, careerPath: selectedId, onboardingComplete: true });
        
        // Also save to localStorage for backward compatibility
        if (typeof window !== "undefined") {
          localStorage.setItem("career", selectedId);
        }
        
        // Route to journey/home page
        router.push("/journey");
      } catch (error) {
        console.error("Failed to save career:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const selectedCareer = CAREERS.find((c) => c.id === selectedId);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#020010] text-slate-900 dark:text-white select-none transition-colors duration-300"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <StarField starCount={300} />

      {/* Subtle nebula */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-indigo-900/15 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen py-10 px-4">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-6"
        >
          <p className="text-xs tracking-[0.4em] text-blue-400/70 uppercase mb-3">Step 2 of 2</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-widest bg-gradient-to-r from-blue-300 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
            Choose Your Career Path
          </h1>
            <p className="mt-3 text-slate-500 dark:text-white/40 text-sm tracking-wide">
            Scroll or drag to rotate · Click to select
          </p>
        </motion.div>

        {/* 3D-ish Orbital cards */}
        <div
          className="relative"
          style={{ width: radius * 2 + 200, height: radius * 2 + 200 }}
        >
          {/* Orbit ring */}
          <div
            className="absolute rounded-full border border-white/[0.05]"
            style={{ width: radius * 2, height: radius * 2, left: 100, top: 100 }}
          />

          {CAREERS.map((career, i) => {
            const baseAngle = (360 / totalCards) * i;
            const angleDeg = baseAngle + rotation;
            const angleRad = ((angleDeg - 90) * Math.PI) / 180;
            const cx = Math.cos(angleRad) * radius + radius + 100;
            const cy = Math.sin(angleRad) * radius + radius + 100;

            // Depth illusion based on y position
            const sinA = Math.sin(((angleDeg - 90) * Math.PI) / 180);
            const depthScale = 0.75 + 0.25 * ((sinA + 1) / 2);
            const depthOpacity = 0.5 + 0.5 * ((sinA + 1) / 2);
            const isSelected = selectedId === career.id;
            const isFront = sinA > 0.5;

            return (
              <motion.div
                key={career.id}
                className="absolute cursor-pointer"
                style={{
                  left: cx - 90,
                  top: cy - 70,
                  width: 180,
                  zIndex: Math.round(depthScale * 10),
                  scale: depthScale,
                  opacity: depthOpacity,
                }}
                onClick={() => setSelectedId(career.id)}
                whileHover={{ scale: depthScale * 1.1 }}
                whileTap={{ scale: depthScale * 0.95 }}
              >
                <div
                  className="rounded-2xl p-5 text-center transition-all duration-200"
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${career.color}30, ${career.glow}20)`
                      : "rgba(255,255,255,0.05)",
                    backdropFilter: "blur(16px)",
                    border: isSelected
                      ? `1.5px solid ${career.color}80`
                      : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: isSelected
                      ? `0 0 30px ${career.glow}40`
                      : isFront ? "0 4px 24px rgba(0,0,0,0.4)" : "none",
                  }}
                >
                  <div className="text-4xl mb-2">{career.icon}</div>
                  <h3
                    className="text-xs font-bold tracking-wide mb-1"
                    style={{ color: isSelected ? career.color : "rgba(255,255,255,0.9)" }}
                  >
                    {career.title}
                  </h3>
                  <p className="text-[10px] text-white/40 mb-2 leading-relaxed">{career.desc}</p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {career.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-[8px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: `${career.color}20`,
                          color: career.color,
                          border: `1px solid ${career.color}30`,
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="mt-2 text-[10px] font-bold"
                      style={{ color: career.color }}
                    >
                      ✓ Selected
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Center glow */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 60,
              height: 60,
              left: radius + 100 - 30,
              top: radius + 100 - 30,
              background: selectedCareer
                ? `radial-gradient(circle, ${selectedCareer.color}40, transparent)`
                : "radial-gradient(circle, rgba(255,255,255,0.05), transparent)",
              transition: "background 0.5s",
            }}
          />
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-4 text-center"
        >
          {selectedCareer && (
            <motion.p
              key={selectedCareer.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm mb-4"
              style={{ color: selectedCareer.color }}
            >
              {selectedCareer.icon} {selectedCareer.title} — {selectedCareer.desc}
            </motion.p>
          )}
          <motion.button
            whileHover={selectedId && !isSaving ? { scale: 1.06 } : {}}
            whileTap={selectedId && !isSaving ? { scale: 0.97 } : {}}
            onClick={handleContinue}
            disabled={!selectedId || isSaving}
            className="px-12 py-4 rounded-full text-sm font-bold tracking-widest uppercase transition-all duration-300"
            style={{
              background: selectedId
                ? `linear-gradient(135deg, ${selectedCareer?.color}, ${selectedCareer?.glow})`
                : "rgba(255,255,255,0.07)",
              border: `1px solid ${selectedId ? selectedCareer?.color + "66" : "rgba(255,255,255,0.12)"}`,
              cursor: selectedId && !isSaving ? "pointer" : "not-allowed",
              color: selectedId ? "#fff" : "rgba(255,255,255,0.25)",
              boxShadow: selectedId ? `0 0 40px ${selectedCareer?.glow}44` : "none",
            }}
          >
            {isSaving ? "Saving..." : selectedId ? "Begin Your Journey →" : "Select a Career Path"}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
