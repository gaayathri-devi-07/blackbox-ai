"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function PlatformSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top center",
        end: "bottom center",
        scrub: 1,
      }
    });

    tl.fromTo(
      section.querySelector(".platform-title"),
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0 }
    ).fromTo(
      section.querySelectorAll(".platform-item"),
      { opacity: 0, x: -30 },
      { opacity: 1, x: 0, stagger: 0.2 }
    );
  }, []);

  return (
    <section
      id="section-1"
      ref={sectionRef}
      className="relative w-full min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#080808] py-24 px-8 flex items-center overflow-hidden"
    >
      <div className="max-w-6xl mx-auto w-full relative z-10">
        <div className="platform-title mb-16">
          <div className="text-white/60 text-xs tracking-[0.3em] uppercase font-bold mb-4">
            WHY BLACKBOX.AI
          </div>
          <h2 className="text-5xl md:text-7xl font-black text-white mb-6">
            AI-POWERED
            <br />
            INTERVIEW MASTERY
          </h2>
        </div>

        <div className="space-y-12">
          <div className="platform-item flex items-start gap-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-white/5 border border-white/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">REAL-TIME AI FEEDBACK</h3>
              <p className="text-white/60 text-lg leading-relaxed">
                Get instant, actionable insights on your responses. Our AI analyzes tone, structure, and delivery to help you improve with every practice session.
              </p>
            </div>
          </div>

          <div className="platform-item flex items-start gap-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-white/5 border border-white/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">PERSONALIZED LEARNING PATH</h3>
              <p className="text-white/60 text-lg leading-relaxed">
                Adaptive algorithms track your progress and customize your practice sessions. Focus on areas that need improvement and accelerate your growth.
              </p>
            </div>
          </div>

          <div className="platform-item flex items-start gap-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-white/5 border border-white/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">24/7 PRACTICE AVAILABILITY</h3>
              <p className="text-white/60 text-lg leading-relaxed">
                Practice anytime, anywhere. No scheduling, no waiting. Your AI interview coach is ready whenever you are.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
