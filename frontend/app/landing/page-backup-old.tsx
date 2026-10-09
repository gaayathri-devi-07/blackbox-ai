"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import Loader from "@/components/landing/Loader";
import CustomCursor from "@/components/landing/CustomCursor";
import MorphingParticles from "@/components/landing/MorphingParticles";
import NewHeroSection from "@/components/landing/NewHeroSection";
import FeaturesOverviewSection from "@/components/landing/FeaturesOverviewSection";
import FeaturesDetailSection from "@/components/landing/FeaturesDetailSection";
import NewCTASection from "@/components/landing/NewCTASection";
import AuthModal from "@/components/landing/AuthModal";

export default function LandingPageOld() {
  const [loading, setLoading] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleGetStarted = () => {
    // Open AuthModal instead of direct navigation
    setShowAuthModal(true);
  };

  // Track scroll progress (0 to 1)
  useEffect(() => {
    if (loading) return;

    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min(Math.max(scrollTop / docHeight, 0), 1);
      
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial call
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading]);

  return (
    <>
      <style jsx global>{`
        body {
          cursor: none;
          overflow-x: hidden;
          background: #0A0A0F;
          scroll-behavior: smooth;
        }
        @media (max-width: 768px) {
          body {
            cursor: auto;
          }
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #0A0A0F;
        }
        ::-webkit-scrollbar-thumb {
          background: #7C3AED;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #8B5CF6;
        }
        
        /* Floating animation */
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
      `}</style>

      {loading && <Loader onComplete={() => setLoading(false)} />}

      {!loading && (
        <>
          <CustomCursor />

          {/* Fixed 3D Particle Canvas Background */}
          <div className="fixed inset-0 z-0 pointer-events-none">
            <Canvas
              camera={{ position: [0, 0, 15], fov: 60 }}
              gl={{
                antialias: true,
                alpha: true,
                powerPreference: "high-performance",
              }}
              dpr={typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 1.5) : 1}
            >
              <MorphingParticles scrollProgress={scrollProgress} />
              
              {/* Bloom post-processing for glow effect */}
              <EffectComposer>
                <Bloom
                  intensity={0.8}
                  luminanceThreshold={0.2}
                  luminanceSmoothing={0.9}
                  radius={0.6}
                />
              </EffectComposer>
            </Canvas>
          </div>

          {/* Animated gradient mesh background */}
          <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
            <div
              className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse"
              style={{
                background: "radial-gradient(circle, #7C3AED40 0%, transparent 70%)",
                animation: "float 20s ease-in-out infinite",
              }}
            />
            <div
              className="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full blur-[140px] animate-pulse"
              style={{
                background: "radial-gradient(circle, #3B82F640 0%, transparent 70%)",
                animation: "float 25s ease-in-out infinite reverse",
              }}
            />
          </div>

          {/* Content sections */}
          <div ref={containerRef} className="relative z-10">
            <NewHeroSection />
            <FeaturesOverviewSection />
            <FeaturesDetailSection />
            <NewCTASection onGetStarted={handleGetStarted} />
          </div>

          {/* Auth Modal */}
          <AuthModal 
            isOpen={showAuthModal} 
            onClose={() => setShowAuthModal(false)} 
          />
        </>
      )}
    </>
  );
}
