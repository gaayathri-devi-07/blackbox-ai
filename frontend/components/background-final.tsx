"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, GithubAuthProvider, signInWithPopup } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";

const IGNORED = ["auth/cancelled-popup-request", "auth/popup-closed-by-user", "auth/popup-blocked"];

// ── Pixel-Build Button ──────────────────────────────────────────────────────────
function PixelBuildButton({ onClick }: { onClick: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const W = wrap.offsetWidth || 260;
    const H = wrap.offsetHeight || 54;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const PIXEL = 4;
    const cols = Math.ceil(W / PIXEL);
    const rows = Math.ceil(H / PIXEL);
    const total = cols * rows;

    ctx.fillStyle = "#000008";
    ctx.fillRect(0, 0, W, H);

    const indices: number[] = Array.from({ length: total }, (_, i) => i);
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    let filled = 0;
    const RATE = 55;
    let animId: number;

    const tick = () => {
      if (filled >= total) {
        ctx.clearRect(0, 0, W, H);
        setInteractive(true);
        return;
      }
      const end = Math.min(filled + RATE, total);
      for (let i = filled; i < end; i++) {
        const idx = indices[i];
        ctx.clearRect(
          (idx % cols) * PIXEL,
          Math.floor(idx / cols) * PIXEL,
          PIXEL,
          PIXEL
        );
      }
      filled = end;
      animId = requestAnimationFrame(tick);
    };

    const timer = setTimeout(() => { animId = requestAnimationFrame(tick); }, 700);
    return () => { clearTimeout(timer); cancelAnimationFrame(animId); };
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", display: "inline-block", borderRadius: "9999px", overflow: "hidden" }}
    >
      <motion.button
        whileHover={interactive ? { scale: 1.07 } : {}}
        whileTap={interactive ? { scale: 0.95 } : {}}
        animate={
          interactive
            ? {
                boxShadow: [
                  "0 0 18px rgba(255,255,255,0.40)",
                  "0 0 52px rgba(255,255,255,0.80)",
                  "0 0 18px rgba(255,255,255,0.40)",
                ],
              }
            : { boxShadow: "none" }
        }
        transition={{ boxShadow: { duration: 2.4, repeat: Infinity } }}
        onClick={interactive ? onClick : undefined}
        style={{
          padding: "1.1rem 4.4rem",
          fontSize: "1.05rem",
          fontWeight: 800,
          letterSpacing: "0.30em",
          textTransform: "uppercase",
          color: "#000000",
          background: "#ffffff",
          border: "none",
          borderRadius: "9999px",
          cursor: interactive ? "pointer" : "default",
          display: "block",
          whiteSpace: "nowrap",
          outline: "none",
        }}
      >
        GET STARTED
      </motion.button>

      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ── Twinkling Stars ──────────────────────────────────────────────────────────────
function TwinkleStars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.4 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.8,
    }));
    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = Date.now() / 1000;
      stars.forEach(s => {
        const alpha = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }} />;
}

// ── Shooting Stars ───────────────────────────────────────────────────────────────
interface Star { id: number; x: number; y: number; angle: number; len: number; dur: number; }

function ShootingStars() {
  const [stars, setStars] = useState<Star[]>([]);
  const counter = useRef(0);
  useEffect(() => {
    const spawn = () => {
      const id = counter.current++;
      const topLeft = Math.random() < 0.4;
      const x = topLeft ? Math.random() * 35 : Math.random() * 90;
      const y = topLeft ? Math.random() * 25 : Math.random() * 50;
      const angle = 20 + Math.random() * 25;
      const len = 160 + Math.random() * 140;
      const dur = 0.65 + Math.random() * 0.45;
      setStars(s => [...s, { id, x, y, angle, len, dur }]);
      setTimeout(() => setStars(s => s.filter(st => st.id !== id)), (dur + 0.15) * 1000);
    };
    spawn();
    const interval = setInterval(spawn, 2000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none", overflow: "hidden" }}>
      <style>{`
        @keyframes shoot {
          0%   { opacity:0; clip-path: inset(0 100% 0 0); }
          10%  { opacity:1; }
          70%  { opacity:0.9; }
          100% { opacity:0; clip-path: inset(0 0% 0 0); }
        }
      `}</style>
      {stars.map(s => (
        <div key={s.id} style={{
          position: "absolute",
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: s.len,
          height: 2,
          borderRadius: 2,
          transform: `rotate(${s.angle}deg)`,
          transformOrigin: "left center",
          animation: `shoot ${s.dur}s ease-out forwards`,
          background: "linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.0) 10%,rgba(200,230,255,1) 70%,rgba(255,255,255,0.6) 85%,rgba(255,255,255,0) 100%)",
        }} />
      ))}
    </div>
  );
}

// ── Floating Feature Cards ────────────────────────────────────────────────────────
const FLOAT_ITEMS = [
  { label: "HR Questions",         x: 4,  dur: 16, delay: -4  },
  { label: "Behavioral",           x: 14, dur: 13, delay: -11 },
  { label: "Technical Discussion", x: 26, dur: 15, delay: -7  },
  { label: "Communication",        x: 38, dur: 14, delay: -2  },
  { label: "Body Language",        x: 50, dur: 17, delay: -9  },
  { label: "Resume & LinkedIn",    x: 61, dur: 12, delay: -5  },
  { label: "Mock Interview",       x: 71, dur: 15, delay: -13 },
  { label: "GD Simulator",         x: 80, dur: 13, delay: -1  },
  { label: "AI Assistant",         x: 89, dur: 14, delay: -8  },
];

function FloatingFeatures() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3, pointerEvents: "none" }}>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(105vh); }
          100% { transform: translateY(-10vh); }
        }
      `}</style>
      {FLOAT_ITEMS.map(item => (
        <div key={item.label} style={{
          position: "absolute",
          left: `${item.x}%`,
          bottom: 0,
          animation: `floatUp ${item.dur}s linear ${item.delay}s infinite`,
          whiteSpace: "nowrap",
          fontSize: "1rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "rgba(210,220,255,0.92)",
        }}>
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ── Landing Page ────────────────────────────────────────────────────────────────
export default function CosmicBackground() {
  const [showLogin, setShowLogin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();

  const handleGetStarted = () => {
    setShowLogin(true);
  };

  const handleOAuth = async (provider: GoogleAuthProvider | GithubAuthProvider) => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        router.push("/companion");
      }
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (!code || !IGNORED.includes(code)) console.error("Auth error:", code);
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      backgroundImage: "url('/img.png')",
      backgroundSize: "100% 100%",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      imageRendering: "crisp-edges",
      filter: "brightness(1.12) contrast(1.08)",
    }}>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.28) 100%)",
          pointerEvents: "none",
        }}
      />

      <TwinkleStars />
      <ShootingStars />

      {!showLogin && <FloatingFeatures />}

      {!showLogin && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          style={{
            position: "absolute",
            top: "2.2rem",
            right: "2.5rem",
            zIndex: 10,
            textAlign: "right",
          }}
        >
          <div style={{
            fontSize: "5.5rem",
            fontWeight: 900,
            letterSpacing: "0.02em",
            color: "#ffffff",
            textTransform: "uppercase",
            textShadow: "0 0 20px rgba(255,255,255,0.45), 0 0 45px rgba(255,255,255,0.18)",
            marginBottom: "0.4rem",
            lineHeight: 1.0,
          }}>
            BLACKBOX.AI
          </div>
          <div style={{
            fontSize: "1.35rem",
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            letterSpacing: "0.04em",
            lineHeight: 1.6,
            textShadow: "0 0 10px rgba(255,255,255,0.35)",
          }}>
            Master Communication. Command Confidence. Conquer Interviews.
          </div>
          <div style={{
            fontSize: "1.15rem",
            fontWeight: 400,
            color: "rgba(255,255,255,0.60)",
            letterSpacing: "0.05em",
            marginTop: "0.35rem",
            fontStyle: "italic",
          }}>
            &quot;Talent gets noticed. Presence gets hired.&quot;
          </div>
        </motion.div>
      )}

      {!showLogin && (
        <div
          style={{
            position: "absolute",
            bottom: "2.5rem",
            right: "2.5rem",
            zIndex: 10,
          }}
        >
          <PixelBuildButton onClick={handleGetStarted} />
        </div>
      )}

      <AnimatePresence>
        {showLogin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(14px)",
              background: "rgba(0, 0, 8, 0.50)",
            }}
            onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              style={{
                width: 400,
                background: "rgba(2, 0, 16, 0.98)",
                borderRadius: "1.6rem",
                border: "1px solid rgba(255,255,255,0.07)",
                padding: "2.8rem",
                boxShadow: "0 0 80px rgba(60,100,255,0.14), 0 40px 80px rgba(0,0,0,0.95)",
                textAlign: "center",
                color: "#fff",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  margin: "0 auto 1.5rem",
                  background: "radial-gradient(circle at 38% 38%, rgba(100,170,255,0.9), rgba(60,40,200,0.6))",
                  boxShadow: "0 0 32px rgba(80,150,255,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem",
                }}
              >
                ✦
              </div>

              <h2 style={{ fontSize: "1.05rem", fontWeight: 900, letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
                BLACKBOX<span style={{ color: "rgba(100,170,255,0.9)" }}>.AI</span>
              </h2>
              <p style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.26)", marginBottom: "2rem", letterSpacing: "0.05em" }}>
                Your interview journey begins here
              </p>

              <button
                onClick={() => handleOAuth(new GoogleAuthProvider())}
                disabled={isLoggingIn}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "0.88rem",
                  borderRadius: "9999px",
                  marginBottom: "0.8rem",
                  background: "rgba(255,255,255,0.97)",
                  color: "#111",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  border: "none",
                  cursor: "pointer",
                  opacity: isLoggingIn ? 0.5 : 1,
                  letterSpacing: "0.02em",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {isLoggingIn ? "Signing in…" : "Continue with Google"}
              </button>

              <button
                onClick={() => handleOAuth(new GithubAuthProvider())}
                disabled={isLoggingIn}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "0.88rem",
                  borderRadius: "9999px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                  opacity: isLoggingIn ? 0.5 : 1,
                  letterSpacing: "0.02em",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                {isLoggingIn ? "Signing in…" : "Continue with GitHub"}
              </button>

              <button
                onClick={() => setShowLogin(false)}
                style={{
                  marginTop: "1.4rem",
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.22)",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.22)")}
              >
                ← Back
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
