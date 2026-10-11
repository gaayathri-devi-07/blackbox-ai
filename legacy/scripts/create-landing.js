const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('  Creating 3D Landing Page Files');
console.log('========================================\n');

// Create directories
const dirs = [
  'components/landing',
  'app/landing',
  'app/auth'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✓ Created: ${dir}`);
  }
});

console.log('\n========================================');
console.log('  Creating Component Files...');
console.log('========================================\n');

// Backup existing page to auth
const existingPage = path.join(__dirname, 'app', 'page.tsx');
const authPage = path.join(__dirname, 'app', 'auth', 'page.tsx');

if (fs.existsSync(existingPage) && !fs.existsSync(authPage)) {
  fs.copyFileSync(existingPage, authPage);
  console.log('✓ Moved app/page.tsx → app/auth/page.tsx\n');
}

// Now create all the files
const files = {
  'components/landing/Loader.tsx': `"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export default function Loader({ onComplete }: { onComplete: () => void }) {
  const loaderRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const title = titleRef.current;
    const progressBar = progressBarRef.current;
    const loader = loaderRef.current;
    if (!title || !progressBar || !loader) return;

    const chars = title.innerText.split("");
    title.innerHTML = chars.map((char) => 
      \`<span style="opacity: 0">\${char === " " ? "&nbsp;" : char}</span>\`
    ).join("");
    const charElements = title.querySelectorAll("span");

    const ctx = gsap.context(() => {
      gsap.to(charElements, {
        opacity: 1,
        duration: 0.05,
        stagger: 0.06,
        ease: "power2.inOut",
      });

      gsap.to({}, {
        duration: 1.8,
        delay: 0.4,
        ease: "power2.inOut",
        onUpdate: function () {
          const prog = Math.round(this.progress() * 100);
          setProgress(prog);
          gsap.set(progressBar, { scaleX: this.progress() });
        },
        onComplete: () => {
          gsap.to(loader, {
            y: "-100vh",
            duration: 0.8,
            ease: "power3.inOut",
            delay: 0.2,
            onComplete: () => onComplete(),
          });
        },
      });
    });

    return () => ctx.revert();
  }, [onComplete]);

  return (
    <div ref={loaderRef} className="fixed inset-0 z-[9999] bg-[#080808] flex flex-col items-center justify-center gap-8">
      <div ref={titleRef} className="text-5xl font-black tracking-[0.2em] text-white uppercase">
        BLACKBOX.AI
      </div>
      <div className="w-[400px] flex flex-col gap-2">
        <div className="w-full h-[3px] bg-indigo-500/20 rounded overflow-hidden">
          <div
            ref={progressBarRef}
            className="w-full h-full bg-gradient-to-r from-indigo-500 to-cyan-400 origin-left"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
        <div className="text-sm text-white/60 text-right font-medium">{progress}%</div>
      </div>
    </div>
  );
}
`,

  'components/landing/CustomCursor.tsx': `"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const onMouseMove = (e: MouseEvent) => {
      gsap.set(dot, { x: e.clientX, y: e.clientY });
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.15, ease: "power2.out" });
    };

    const onMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.tagName === "A" || 
          target.closest("button") || target.closest("a")) {
        setIsHovering(true);
      }
    };

    const onMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.tagName === "A" ||
          target.closest("button") || target.closest("a")) {
        setIsHovering(false);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseenter", onMouseEnter, true);
    document.addEventListener("mouseleave", onMouseLeave, true);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseenter", onMouseEnter, true);
      document.removeEventListener("mouseleave", onMouseLeave, true);
    };
  }, []);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    if (isHovering) {
      gsap.to(dot, { scale: 0, duration: 0.2, ease: "power2.out" });
      gsap.to(ring, {
        scale: 2.5,
        backgroundColor: "rgba(108, 99, 255, 0.2)",
        duration: 0.2,
        ease: "power2.out",
      });
    } else {
      gsap.to(dot, { scale: 1, duration: 0.2, ease: "power2.out" });
      gsap.to(ring, {
        scale: 1,
        backgroundColor: "transparent",
        duration: 0.2,
        ease: "power2.out",
      });
    }
  }, [isHovering]);

  return (
    <>
      <div
        ref={dotRef}
        className="fixed w-1.5 h-1.5 rounded-full bg-white pointer-events-none z-[99999] -translate-x-1/2 -translate-y-1/2 mix-blend-difference"
      />
      <div
        ref={ringRef}
        className="fixed w-8 h-8 border border-indigo-500/60 rounded-full pointer-events-none z-[99998] -translate-x-1/2 -translate-y-1/2"
      />
    </>
  );
}
`,

  'components/landing/ParticleSystem.tsx': `"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ParticleSystemProps {
  count?: number;
  colorStart?: string;
  colorEnd?: string;
}

export default function ParticleSystem({
  count = 10000,
  colorStart = "#6C63FF",
  colorEnd = "#00F5FF",
}: ParticleSystemProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorStart3 = new THREE.Color(colorStart);
    const colorEnd3 = new THREE.Color(colorEnd);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Sphere distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const radius = 2 + Math.random() * 0.5;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // Color gradient from center
      const dist = Math.sqrt(positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2);
      const t = Math.min(dist / 3, 1);
      const color = colorStart3.clone().lerp(colorEnd3, t);

      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    return { positions, colors };
  }, [count, colorStart, colorEnd]);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const time = state.clock.elapsedTime;
    const geometry = pointsRef.current.geometry;
    const posAttr = geometry.attributes.position;

    // Breathing animation
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const breathScale = 1 + Math.sin(time * 0.5 + i * 0.01) * 0.1;
      
      posAttr.setXYZ(
        i,
        positions[i3] * breathScale,
        positions[i3 + 1] * breathScale,
        positions[i3 + 2] * breathScale
      );
    }

    posAttr.needsUpdate = true;
    pointsRef.current.rotation.y = time * 0.05;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
`,

  'components/landing/HeroSection.tsx': `"use client";

import { useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import ParticleSystem from "./ParticleSystem";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export default function HeroSection({ onGetStarted }: HeroSectionProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const title = titleRef.current;
    const subtitle = subtitleRef.current;

    if (title) {
      const chars = title.innerText.split("");
      title.innerHTML = chars.map((char) => 
        \`<span style="display: inline-block; opacity: 0; transform: translateY(-80px)">\${char === " " ? "&nbsp;" : char}</span>\`
      ).join("");
      
      gsap.to(title.querySelectorAll("span"), {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.03,
        ease: "power4.out",
        delay: 0.3,
      });
    }

    if (subtitle) {
      const chars = subtitle.innerText.split("");
      subtitle.innerHTML = chars.map((char) => 
        \`<span style="display: inline-block; opacity: 0; transform: translateY(-80px)">\${char === " " ? "&nbsp;" : char}</span>\`
      ).join("");
      
      gsap.to(subtitle.querySelectorAll("span"), {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.03,
        ease: "power4.out",
        delay: 0.8,
      });
    }
  }, []);

  return (
    <section className="relative w-full h-screen overflow-hidden bg-[#080808]">
      {/* Three.js Background */}
      <div className="fixed inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 75 }}
          gl={{ 
            antialias: true,
            pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 1.5) : 1
          }}
        >
          <ParticleSystem count={10000} />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-8">
        {/* Top Navigation */}
        <div className="absolute top-8 left-8 right-8 flex justify-between items-center">
          <div className="text-white text-lg tracking-[0.2em] font-bold">
            BLACKBOX.AI
          </div>
          <button
            onClick={onGetStarted}
            className="text-white/60 hover:text-white text-sm transition-colors"
          >
            Sign In
          </button>
        </div>

        {/* Hero Content */}
        <div className="text-center space-y-6 max-w-4xl">
          <h1 ref={titleRef} className="text-7xl md:text-9xl font-black tracking-tight text-white leading-none">
            MASTER EVERY
          </h1>
          <h1 ref={subtitleRef} className="text-7xl md:text-9xl font-black tracking-tight bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent leading-none">
            INTERVIEW
          </h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.6, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3 }}
            className="text-xl text-white/60 max-w-2xl mx-auto"
          >
            AI-powered coaching for HR, Behavioral, Technical & more.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.6 }}
            whileHover={{ 
              scale: 1.04,
              boxShadow: "0 0 40px rgba(108,99,255,0.5)",
              backgroundColor: "rgba(108,99,255,1)"
            }}
            whileTap={{ scale: 0.98 }}
            onClick={onGetStarted}
            className="mt-8 px-12 py-4 text-lg font-bold uppercase tracking-wider border border-indigo-500/60 text-white rounded transition-all"
          >
            Get Started →
          </motion.button>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/40 text-sm flex flex-col items-center gap-2"
        >
          <span>Scroll to explore</span>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-2"
          >
            <div className="w-1 h-2 bg-white/40 rounded-full" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
`,

  'components/landing/LearningHubSection.tsx': `"use client";

import { useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import * as THREE from "three";

function OrbitingSystem() {
  const groupRef = useRef<THREE.Group>(null);

  const orbitData = [
    { name: "HR Questions", color: "#FFB84D", radius: 1.5, speed: 0.3, offset: 0 },
    { name: "Behavioral", color: "#FF6B9D", radius: 1.8, speed: 0.25, offset: Math.PI / 3 },
    { name: "Technical", color: "#00F5FF", radius: 2.1, speed: 0.2, offset: (Math.PI * 2) / 3 },
    { name: "Communication", color: "#7FFF00", radius: 1.7, speed: 0.28, offset: Math.PI },
    { name: "Body Language", color: "#A855F7", radius: 2.0, speed: 0.22, offset: (Math.PI * 4) / 3 },
    { name: "Resume", color: "#FF8C42", radius: 1.9, speed: 0.24, offset: (Math.PI * 5) / 3 },
  ];

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.1;
  });

  return (
    <group ref={groupRef}>
      {/* Central nucleus */}
      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#6C63FF" emissive="#6C63FF" emissiveIntensity={2} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={2} color="#6C63FF" />

      {/* Orbiting spheres */}
      {orbitData.map((orbit, i) => (
        <OrbitingSphere key={i} {...orbit} index={i} />
      ))}
    </group>
  );
}

function OrbitingSphere({ color, radius, speed, offset, index }: any) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime * speed + offset;
    meshRef.current.position.x = Math.cos(t) * radius;
    meshRef.current.position.z = Math.sin(t) * radius;
    meshRef.current.position.y = Math.sin(t * 2) * 0.2;
  });

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={0.5} color={color} distance={2} />
    </>
  );
}

export default function LearningHubSection() {
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (headingRef.current) {
      const text = headingRef.current.innerText;
      headingRef.current.innerHTML = text.split("").map((char) => 
        \`<span style="display: inline-block; opacity: 0; transform: translateY(80px)">\${char === " " ? "&nbsp;" : char}</span>\`
      ).join("");

      gsap.to(headingRef.current.querySelectorAll("span"), {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.02,
        ease: "power4.out",
      });
    }
  }, []);

  return (
    <section className="relative w-full h-screen bg-[#080808]">
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <ambientLight intensity={0.5} />
          <OrbitingSystem />
        </Canvas>
      </div>

      <div className="relative z-10 flex items-center h-full px-16">
        <div className="max-w-xl space-y-4">
          <div className="text-indigo-500 text-xs tracking-[0.25em] uppercase font-bold">
            PLATFORM
          </div>
          <h2 ref={headingRef} className="text-6xl font-black text-white leading-tight">
            Your Complete Learning Hub
          </h2>
          <p className="text-lg text-white/60 leading-relaxed">
            Six specialized modules, one unified platform. Every aspect of interview mastery — engineered to perfection.
          </p>
        </div>
      </div>
    </section>
  );
}
`,

  'components/landing/FeaturesSection.tsx': `"use client";

import { motion } from "framer-motion";

const features = [
  {
    number: "01",
    title: "HR Questions",
    desc: "Navigate workplace dynamics, policy queries, and situational judgment with confidence.",
    color: "#FFB84D",
  },
  {
    number: "02",
    title: "Behavioral",
    desc: "Master the STAR method. Craft compelling stories that land every competency-based question.",
    color: "#FF6B9D",
  },
  {
    number: "03",
    title: "Technical Discussion",
    desc: "From system design to deep dives — practice with AI that thinks like your interviewer.",
    color: "#00F5FF",
  },
  {
    number: "04",
    title: "Communication",
    desc: "Refine tone, clarity, and delivery. Real-time AI feedback on how you say it, not just what.",
    color: "#7FFF00",
  },
  {
    number: "05",
    title: "Body Language",
    desc: "Posture, eye contact, presence — train the non-verbal signals that make interviewers lean in.",
    color: "#A855F7",
  },
  {
    number: "06",
    title: "Resume & LinkedIn",
    desc: "AI-optimized profiles and resumes that pass ATS filters and impress humans on first glance.",
    color: "#FF8C42",
  },
];

function hexToRgb(hex: string) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return result
    ? \`\${parseInt(result[1], 16)}, \${parseInt(result[2], 16)}, \${parseInt(result[3], 16)}\`
    : "108, 99, 255";
}

export default function FeaturesSection() {
  return (
    <section className="relative w-full min-h-screen bg-[#080808]">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
        {features.map((feature, i) => (
          <div
            key={i}
            className="h-screen flex items-center justify-center p-16 border-t"
            style={{
              background: \`linear-gradient(135deg, rgba(\${hexToRgb(feature.color)}, 0.05) 0%, #080808 100%)\`,
              borderTopColor: feature.color,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative max-w-md space-y-6"
            >
              <div
                className="text-9xl font-black opacity-5 absolute -top-8 -left-4"
                style={{ color: feature.color }}
              >
                {feature.number}
              </div>
              <div className="relative z-10">
                <h3
                  className="text-5xl font-black mb-4"
                  style={{ color: feature.color }}
                >
                  {feature.title}
                </h3>
                <p className="text-lg text-white/60 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}
`,

  'components/landing/CTASection.tsx': `"use client";

import { motion } from "framer-motion";

interface CTASectionProps {
  onGetStarted: () => void;
}

export default function CTASection({ onGetStarted }: CTASectionProps) {
  return (
    <section className="relative w-full h-screen bg-[#080808] flex items-center justify-center">
      <div className="text-center space-y-8 px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-indigo-500 text-xs tracking-[0.3em] uppercase font-bold"
        >
          BEGIN YOUR JOURNEY
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h2 className="text-7xl md:text-8xl font-black text-white mb-4">
            Are you ready
          </h2>
          <h2 className="text-7xl md:text-8xl font-black bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent italic">
            to ace it?
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 0.6, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg text-white/60 max-w-xl mx-auto"
        >
          Join thousands mastering interviews with AI-powered practice. Your next opportunity starts here.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          whileHover={{ 
            scale: 1.05,
            boxShadow: "0 0 60px rgba(108,99,255,0.7)",
            backgroundColor: "#7B74FF"
          }}
          whileTap={{ scale: 0.98 }}
          onClick={onGetStarted}
          className="px-12 py-5 text-lg font-bold bg-indigo-600 text-white rounded transition-all"
        >
          Get Started — It's Free →
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.4 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-sm text-white/40"
        >
          Already have an account?{" "}
          <button
            onClick={onGetStarted}
            className="underline hover:text-white/60 transition"
          >
            Sign in
          </button>
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.2 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-8 left-0 right-0 text-center text-xs text-white/20"
        >
          <p>© 2026 Blackbox AI. All rights reserved.</p>
        </motion.div>
      </div>
    </section>
  );
}
`,

  'app/landing/page.tsx': `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/landing/Loader";
import CustomCursor from "@/components/landing/CustomCursor";
import HeroSection from "@/components/landing/HeroSection";
import LearningHubSection from "@/components/landing/LearningHubSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import CTASection from "@/components/landing/CTASection";

export default function LandingPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const handleGetStarted = () => {
    router.push("/auth");
  };

  return (
    <>
      <style jsx global>{\`
        body {
          cursor: none;
          overflow-x: hidden;
        }
        @media (max-width: 768px) {
          body {
            cursor: auto;
          }
        }
      \`}</style>

      {loading && <Loader onComplete={() => setLoading(false)} />}
      
      {!loading && (
        <>
          <CustomCursor />
          
          <div className="relative">
            <HeroSection onGetStarted={handleGetStarted} />
            <LearningHubSection />
            <FeaturesSection />
            <CTASection onGetStarted={handleGetStarted} />
          </div>
        </>
      )}
    </>
  );
}
`,

  'app/page.tsx': `"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/landing");
  }, [router]);
  
  return (
    <div className="fixed inset-0 bg-[#080808] flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );
}
`
};

// Write all files
let count = 0;
Object.entries(files).forEach(([relativePath, content]) => {
  const fullPath = path.join(__dirname, relativePath);
  fs.writeFileSync(fullPath, content, 'utf8');
  count++;
  console.log(\`✓ (\${count}/\${Object.keys(files).length}) \${relativePath}\`);
});

console.log('\n========================================');
console.log('✅ SUCCESS! All files created!');
console.log('========================================\n');
console.log('📂 Files created:');
console.log('   • components/landing/*.tsx (7 files)');
console.log('   • app/landing/page.tsx');
console.log('   • app/auth/page.tsx (your existing auth)');
console.log('   • app/page.tsx (redirects to /landing)\n');
console.log('🚀 Next steps:');
console.log('   1. npm run dev');
console.log('   2. Visit http://localhost:3000');
console.log('   3. Experience the 3D landing page!\n');
