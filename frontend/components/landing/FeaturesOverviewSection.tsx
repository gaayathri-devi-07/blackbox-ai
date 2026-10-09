"use client";

import { motion } from "framer-motion";
import { GraduationCap, Bot, Mic, Users, TrendingUp } from "lucide-react";
import { useInView } from "framer-motion";
import { useRef } from "react";

const features = [
  {
    icon: GraduationCap,
    title: "Learning Hub",
    description: "Personalized learning paths powered by AI. Master any skill at your pace.",
    color: "#7C3AED",
    gradient: "from-purple-500/20 to-transparent",
  },
  {
    icon: Bot,
    title: "Project AI",
    description: "Build real-world projects with an AI co-pilot by your side.",
    color: "#3B82F6",
    gradient: "from-blue-500/20 to-transparent",
  },
  {
    icon: Mic,
    title: "Mock Interview",
    description: "Practice with an AI interviewer. Get instant feedback and scoring.",
    color: "#06B6D4",
    gradient: "from-cyan-500/20 to-transparent",
  },
  {
    icon: Users,
    title: "GD Simulator",
    description: "Simulate group discussions. Sharpen your communication under pressure.",
    color: "#8B5CF6",
    gradient: "from-violet-500/20 to-transparent",
  },
  {
    icon: TrendingUp,
    title: "Improvement Plan",
    description: "Get a personalized weekly plan based on your performance analytics.",
    color: "#A855F7",
    gradient: "from-fuchsia-500/20 to-transparent",
  },
];

export default function FeaturesOverviewSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  return (
    <section
      id="features-overview"
      ref={ref}
      className="relative w-full min-h-screen flex items-center py-24 px-6 sm:px-8 lg:px-12"
    >
      <div className="relative z-10 max-w-7xl mx-auto w-full">
        {/* Section title */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2
            className="text-[clamp(2rem,5vw,4rem)] font-black text-white mb-6 tracking-[-0.02em] leading-[1.1]"
            style={{ transform: "scaleY(1.1)" }}
          >
            Everything You Need to Succeed
          </h2>
        </motion.div>
        
        {/* Feature cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group relative"
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: "easeOut",
              }}
            >
              {/* Glass card */}
              <div className="relative h-full bg-white/[0.04] backdrop-blur-xl rounded-2xl p-8 border border-white/10 overflow-hidden transition-all duration-300 hover:bg-white/[0.06] hover:border-white/20 hover:shadow-2xl hover:shadow-purple-500/10">
                {/* Top colored border */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `linear-gradient(90deg, ${feature.color}, transparent)`,
                  }}
                />
                
                {/* Animated gradient border on hover */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, ${feature.color}33, transparent)`,
                  }}
                />
                
                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 relative overflow-hidden"
                  style={{
                    backgroundColor: `${feature.color}22`,
                  }}
                >
                  <feature.icon className="w-7 h-7 relative z-10" style={{ color: feature.color }} />
                  <div
                    className="absolute inset-0 bg-gradient-to-br opacity-20"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${feature.color}, transparent)`,
                    }}
                  />
                </div>
                
                {/* Content */}
                <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-[#F8FAFC] transition-colors tracking-[-0.01em]">
                  {feature.title}
                </h3>
                <p className="text-[#94A3B8] leading-relaxed group-hover:text-[#CBD5E1] transition-colors font-medium">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
