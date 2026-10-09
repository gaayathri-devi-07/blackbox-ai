"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";

const features = [
  {
    title: "HR QUESTIONS",
    description: "Navigate workplace dynamics, policy queries, and situational judgment with confidence.",
    icon: "💼"
  },
  {
    title: "BEHAVIORAL",
    description: "Master the STAR method. Craft compelling stories that land every competency-based question.",
    icon: "🧠"
  },
  {
    title: "TECHNICAL DISCUSSION",
    description: "From system design to deep dives — practice with AI that thinks like your interviewer.",
    icon: "💻"
  },
  {
    title: "COMMUNICATION",
    description: "Refine tone, clarity, and delivery. Real-time AI feedback on how you say it, not just what.",
    icon: "🎤"
  }
];

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = sectionRef.current?.querySelectorAll(".feature-card");
    if (!cards) return;

    cards.forEach((card, index) => {
      gsap.fromTo(
        card,
        { opacity: 0, x: -100 },
        {
          opacity: 1,
          x: 0,
          duration: 0.8,
          delay: index * 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: card,
            start: "top 80%",
            toggleActions: "play none none none"
          }
        }
      );
    });
  }, []);

  return (
    <section
      id="section-2"
      ref={sectionRef}
      className="relative w-full min-h-screen bg-[#0a0a0a] py-24 px-8 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="text-white/60 text-xs tracking-[0.3em] uppercase font-bold mb-4">
            PLATFORM
          </div>
          <h2 className="text-5xl md:text-7xl font-black text-white mb-6">
            YOUR COMPLETE
            <br />
            LEARNING HUB
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Four specialized modules, one unified platform. Every aspect of interview mastery — engineered to perfection.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="feature-card group relative bg-[#0f0f12]/80 backdrop-blur-sm border border-white/10 rounded-lg p-8 hover:border-white/30 transition-all duration-500 overflow-hidden"
            >
              {/* Subtle glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-white/5" />

              <div className="relative z-10">
                <div className="text-5xl mb-4">{feature.icon}</div>
                
                <div className="text-sm font-black tracking-wider uppercase mb-3 text-white">
                  {feature.title}
                </div>

                <p className="text-white/60 text-base leading-relaxed">
                  {feature.description}
                </p>

                {/* Card number watermark */}
                <div className="absolute bottom-4 right-8 text-[120px] font-black opacity-5 text-white">
                  {String(index + 1).padStart(2, "0")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
