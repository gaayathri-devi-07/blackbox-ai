"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Sparkles, Zap, Target, Brain } from "lucide-react";

const detailedFeatures = [
  {
    icon: Sparkles,
    title: "AI-Powered Learning Paths",
    description:
      "Our intelligent system adapts to your learning style and pace. Every lesson, every challenge, every milestone is personalized to help you reach your career goals faster.",
    image: "/feature-1.jpg", // placeholder
    align: "left",
  },
  {
    icon: Zap,
    title: "Real-Time Feedback Engine",
    description:
      "Get instant, actionable feedback on your interview performance. Our AI analyzes your speech patterns, body language, and technical accuracy to help you improve continuously.",
    image: "/feature-2.jpg",
    align: "right",
  },
  {
    icon: Target,
    title: "Company-Specific Practice",
    description:
      "Prepare for Google, Amazon, Microsoft, and more with tailored interview simulations. Practice the exact questions and scenarios you'll face in your dream job interview.",
    image: "/feature-3.jpg",
    align: "left",
  },
  {
    icon: Brain,
    title: "Collaborative Learning",
    description:
      "Join group discussions, compete in coding challenges, and learn from peers. Our platform connects you with a community of ambitious learners just like you.",
    image: "/feature-4.jpg",
    align: "right",
  },
];

export default function FeaturesDetailSection() {
  return (
    <section
      id="features-detail"
      className="relative w-full min-h-screen py-24 px-6 sm:px-8 lg:px-12"
      style={{
        background: "radial-gradient(ellipse at center, #7C3AED08 0%, #0A0A0F 70%)",
      }}
    >
      <div className="relative z-10 max-w-7xl mx-auto space-y-32">
        {detailedFeatures.map((feature, index) => (
          <FeatureRow key={feature.title} feature={feature} index={index} />
        ))}
      </div>
    </section>
  );
}

function FeatureRow({ feature, index }: { feature: typeof detailedFeatures[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-150px" });
  
  const isLeft = feature.align === "left";
  
  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      {/* Text content */}
      <motion.div
        className={`${isLeft ? "lg:order-1" : "lg:order-2"} space-y-6`}
        initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#7C3AED]/20 flex items-center justify-center border border-[#7C3AED]/30">
          <feature.icon className="w-8 h-8 text-[#7C3AED]" />
        </div>
        
        <h3
          className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-[-0.02em]"
          style={{ transform: "scaleY(1.1)" }}
        >
          {feature.title}
        </h3>
        
        <p className="text-lg text-[#94A3B8] leading-relaxed font-medium">
          {feature.description}
        </p>
        
        <div className="pt-4">
          <div className="inline-block px-6 py-3 rounded-lg bg-gradient-to-r from-[#7C3AED]/20 to-transparent border border-[#7C3AED]/30">
            <span className="text-white font-semibold">Learn More →</span>
          </div>
        </div>
      </motion.div>
      
      {/* Visual placeholder (icon-based since no images) */}
      <motion.div
        className={`${isLeft ? "lg:order-2" : "lg:order-1"}`}
        initial={{ opacity: 0, x: isLeft ? 50 : -50 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        <div className="relative aspect-video rounded-3xl overflow-hidden bg-gradient-to-br from-[#7C3AED]/10 to-[#3B82F6]/10 border border-white/5 flex items-center justify-center group">
          {/* Animated grid background */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(#7C3AED 1px, transparent 1px),
                linear-gradient(90deg, #7C3AED 1px, transparent 1px)
              `,
              backgroundSize: "50px 50px",
            }}
          />
          
          {/* Large centered icon */}
          <feature.icon className="w-32 h-32 text-[#7C3AED]/40 group-hover:text-[#7C3AED]/60 transition-colors duration-500" />
          
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#7C3AED]/20 via-transparent to-[#3B82F6]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
      </motion.div>
    </div>
  );
}
