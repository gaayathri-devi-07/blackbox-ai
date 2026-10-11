"use client";

import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, GithubAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { StarField } from "./star-field";

// ── Static data ────────────────────────────────────────────────────────────────

const FEATURE_POSITIONS = [
  { x: 2,  y: 10 }, { x: 73, y: 8  },
  { x: 1,  y: 48 }, { x: 80, y: 46 },
  { x: 4,  y: 79 }, { x: 69, y: 80 },
];
const FEATURE_ICONS  = ["🎤", "🧠", "💻", "💬", "🤝", "📄"];
const FEATURE_BORDER = [
  "rgba(139,92,246,0.5)", "rgba(59,130,246,0.5)",  "rgba(52,211,153,0.5)",
  "rgba(244,114,182,0.5)","rgba(251,191,36,0.5)",   "rgba(96,165,250,0.5)",
];
const FEATURE_BG = [
  "rgba(139,92,246,0.08)","rgba(59,130,246,0.08)","rgba(52,211,153,0.08)",
  "rgba(244,114,182,0.08)","rgba(251,191,36,0.08)","rgba(96,165,250,0.08)",
];
const IGNORED = [
  "auth/cancelled-popup-request",
  "auth/popup-closed-by-user",
  "auth/popup-blocked",
];

// ── Canvas Shooting Stars (one every ~2 s, realistic trail + head) ────────────

function ShootingStarsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      c.width  = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface S {
      x: number; y: number;
      vx: number; vy: number; spd: number;
      trail: number; life: number; max: number;
    }
    const stars: S[] = [];
    let lastSpawn = 0;
    let animId: number;

    const spawn = () => {
      // Random angle 20–45° below horizontal → diagonal shooting motion
      const ang = (20 + Math.random() * 25) * (Math.PI / 180);
      const spd = 9 + Math.random() * 8;
      stars.push({
        x:     Math.random() * c.width  * 0.82,
        y:     Math.random() * c.height * 0.52,
        vx:    Math.cos(ang) * spd,
        vy:    Math.sin(ang) * spd,
        spd,
        trail: 70 + Math.random() * 120,
        life:  0,
        max:   44 + Math.floor(Math.random() * 36),
      });
    };

    const draw = (t: number) => {
      animId = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, c.width, c.height);

      // Spawn once every 2 s
      if (t - lastSpawn > 2000) { spawn(); lastSpawn = t; }

      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.life++;
        const ratio = s.life / s.max;
        // Fade in for first 15%, hold, fade out after 72%
        const alpha =
          ratio < 0.15 ? ratio / 0.15
          : ratio > 0.72 ? 1 - (ratio - 0.72) / 0.28
          : 1;

        const nx = s.vx / s.spd, ny = s.vy / s.spd;
        const tx = s.x - nx * s.trail;
        const ty = s.y - ny * s.trail;

        // Gradient trail: transparent tail → bright head
        const lg = ctx.createLinearGradient(tx, ty, s.x, s.y);
        lg.addColorStop(0,    "rgba(255,255,255,0)");
        lg.addColorStop(0.55, `rgba(210,232,255,${alpha * 0.35})`);
        lg.addColorStop(1,    `rgba(255,255,255,${alpha})`);

        ctx.save();
        ctx.strokeStyle = lg;
        ctx.lineWidth   = 1.6;
        ctx.lineCap     = "round";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        // Radial glow at head
        const hg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 4);
        hg.addColorStop(0,   `rgba(255,255,255,${alpha})`);
        hg.addColorStop(0.4, `rgba(210,235,255,${alpha * 0.45})`);
        hg.addColorStop(1,   "rgba(255,255,255,0)");
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        s.x += s.vx;
        s.y += s.vy;
        if (s.life >= s.max || s.x > c.width + 160 || s.y > c.height + 160)
          stars.splice(i, 1);
      }
    };

    setTimeout(spawn, 600);       // first star slightly delayed
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 6 }}
    />
  );
}

// ── Black Hole Rings SVG (this part rotates) ──────────────────────────────────
// Event horizon + accretion disk rings only. Jet is a separate static element.

function BHRings() {
  // 720×720 coordinate space; black hole centered at (360, 360)
  const CX = 360, CY = 360;
  const R   = 185;              // event horizon radius
  const DRX = 310, DRY = 86;   // accretion disk ellipse

  return (
    <svg
      width={720}
      height={720}
      viewBox="0 0 720 720"
      style={{ overflow: "visible", display: "block" }}
    >
      <defs>
        {/* Progressive glow filters */}
        <filter id="f1" x="-80%"  y="-80%"  width="260%" height="260%">
          <feGaussianBlur stdDeviation="5"  result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="f2" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="13" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="f3" x="-160%" y="-160%" width="420%" height="420%">
          <feGaussianBlur stdDeviation="26" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="f4" x="-260%" y="-260%" width="620%" height="620%">
          <feGaussianBlur stdDeviation="48" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* Clip top / bottom halves of the disk */}
        <clipPath id="cT"><rect x="-4000" y="-4000" width="8720" height={CY + 4000}/></clipPath>
        <clipPath id="cB"><rect x="-4000" y={CY}    width="8720" height="8000"/></clipPath>

        {/* Outer diffuse halo */}
        <radialGradient id="halo" cx="50%" cy="54%" r="50%">
          <stop offset="0%"   stopColor="rgba(155,205,255,0.18)"/>
          <stop offset="60%"  stopColor="rgba(100,170,255,0.04)"/>
          <stop offset="100%" stopColor="rgba(60,120,210,0)"/>
        </radialGradient>
      </defs>

      {/* 1 – Outer diffuse halo */}
      <ellipse cx={CX} cy={CY} rx={380} ry={165} fill="url(#halo)" filter="url(#f4)"/>

      {/* 2 – Broad soft ring glow */}
      <ellipse cx={CX} cy={CY} rx={DRX+28} ry={DRY+16}
               fill="none" stroke="rgba(115,185,255,0.07)" strokeWidth={70} filter="url(#f4)"/>

      {/* 3 – Top arc: dimmer / gravitationally lensed */}
      <ellipse cx={CX} cy={CY} rx={DRX} ry={DRY}
               fill="none" stroke="rgba(210,235,255,0.26)" strokeWidth={2.5}
               clipPath="url(#cT)" filter="url(#f2)"/>

      {/* 4 – Bottom arc: BRIGHT Doppler-boosted main ring */}
      <ellipse cx={CX} cy={CY} rx={DRX} ry={DRY+6}
               fill="none" stroke="rgba(255,255,255,0.97)" strokeWidth={10}
               clipPath="url(#cB)" filter="url(#f3)"/>

      {/* 5 – Lensed photon crescent hotspot at bottom */}
      <ellipse cx={CX} cy={CY + DRY + 8} rx={105} ry={26}
               fill="rgba(255,255,255,0.7)" filter="url(#f3)"/>

      {/* 6 – Subtle inner ring */}
      <ellipse cx={CX} cy={CY} rx={208} ry={54}
               fill="none" stroke="rgba(220,240,255,0.34)" strokeWidth={2} filter="url(#f1)"/>

      {/* 7 – Event horizon: pitch black */}
      <circle cx={CX} cy={CY} r={R} fill="#000000"/>

      {/* 8 – Photon sphere thin hint */}
      <circle cx={CX} cy={CY} r={R + 7}
              fill="none" stroke="rgba(188,224,255,0.13)" strokeWidth={12} filter="url(#f1)"/>
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CosmicBackground() {
  const [showLogin, setShowLogin]     = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router   = useRouter();
  const popupRef = useRef(false);

  const features = [
    "HR Questions", "Behavioral", "Technical Discussion",
    "Communication", "Body Language", "Resume & LinkedIn",
  ];

  const handleOAuthLogin = async (provider: GoogleAuthProvider | GithubAuthProvider) => {
    if (popupRef.current) return;
    popupRef.current = true;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, provider);
      router.push("/companion");
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code && IGNORED.includes(code)) return;
      console.error("Login error:", error);
    } finally {
      popupRef.current = false;
      setIsLoggingIn(false);
    }
  };

  return (
    <div
      className="relative h-screen w-full overflow-hidden text-white"
      style={{ background: "#000000" }}
    >
      {/* ── Layer 1: Twinkling stars ── */}
      <StarField starCount={220} />

      {/* ── Layer 2: Shooting stars ── */}
      <ShootingStarsCanvas />

      {/* ── Layer 3: Static full-screen jet line ──
           The bright horizontal line that cuts through the black hole.
           Kept separate so it doesn't rotate with the rings.           */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "50%", left: 0, right: 0,
          height: "3px",
          transform: "translateY(-50%)",
          zIndex: 3,
        }}
      >
        <div style={{
          width: "100%", height: "100%",
          background:
            "linear-gradient(90deg," +
            "rgba(200,225,255,0) 0%," +
            "rgba(215,235,255,0.38) 16%," +
            "rgba(255,255,255,0.92) 42%," +
            "rgba(255,255,255,1) 50%," +
            "rgba(255,255,255,0.92) 58%," +
            "rgba(215,235,255,0.38) 84%," +
            "rgba(200,225,255,0) 100%)",
          boxShadow: "0 0 6px 2px rgba(210,235,255,0.5), 0 0 22px 3px rgba(200,225,255,0.22)",
        }}/>
      </div>

      {/* ── Layer 4: Rotating black hole rings ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          top:  "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 4,
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 160, repeat: Infinity, ease: "linear" }}
          style={{ originX: "50%", originY: "50%" }}
        >
          <BHRings />
        </motion.div>
      </div>

      {/* ── Floating Feature Pills ── */}
      {features.map((feat, i) => {
        const { x, y } = FEATURE_POSITIONS[i];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1, scale: 1,
              y: [0, -12, 0],
              x: [0, i % 2 === 0 ? 5 : -5, 0],
            }}
            transition={{
              opacity: { duration: 0.7, delay: i * 0.18 },
              scale:   { duration: 0.7, delay: i * 0.18 },
              y: { duration: 5 + i * 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.4  },
              x: { duration: 7 + i * 0.7, repeat: Infinity, ease: "easeInOut", delay: i * 0.3  },
            }}
            style={{
              position: "absolute",
              left: `${x}%`, top: `${y}%`,
              background:    FEATURE_BG[i],
              backdropFilter:"blur(14px)",
              border:        `1px solid ${FEATURE_BORDER[i]}`,
              boxShadow:     "0 4px 18px rgba(0,0,0,0.55)",
              borderRadius:  "9999px",
              padding:       "7px 15px",
              fontSize:      "0.77rem",
              fontWeight:    600,
              whiteSpace:    "nowrap",
              zIndex:        8,
              cursor:        "default",
              userSelect:    "none",
              color:         "rgba(255,255,255,0.82)",
            }}
          >
            <span style={{ marginRight: 7 }}>{FEATURE_ICONS[i]}</span>
            {feat}
          </motion.div>
        );
      })}

      {/* ── Centre Text ── */}
      <div
        className={`${showLogin ? "blur-sm pointer-events-none" : ""} absolute inset-0 flex flex-col items-center justify-center text-center px-6 transition-all`}
        style={{ zIndex: 10 }}
      >
        {/* App name — block letters, moderate size, glowing white */}
        <motion.h1
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          className="select-none font-black uppercase"
          style={{
            fontSize:    "clamp(1.5rem, 4vw, 2.8rem)",
            letterSpacing: "0.42em",
            color:       "#ffffff",
            textShadow:
              "0 0 8px rgba(255,255,255,1)," +
              "0 0 22px rgba(200,228,255,0.85)," +
              "0 0 55px rgba(160,210,255,0.5)," +
              "0 0 100px rgba(120,185,255,0.22)",
            fontFamily: "var(--font-geist-mono), 'Courier New', monospace",
          }}
        >
          BLACKBOX.AI
        </motion.h1>

        {/* Primary tagline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          style={{
            marginTop:     "0.9rem",
            fontSize:      "clamp(0.6rem, 1.4vw, 0.82rem)",
            letterSpacing: "0.16em",
            color:         "rgba(255,255,255,0.72)",
            fontWeight:    400,
          }}
        >
          Master Communication · Command Confidence · Conquer Interviews
        </motion.p>

        {/* Sub-quote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.9 }}
          style={{
            marginTop:     "0.42rem",
            fontSize:      "clamp(0.56rem, 1.1vw, 0.72rem)",
            letterSpacing: "0.07em",
            color:         "rgba(255,255,255,0.35)",
            fontStyle:     "italic",
          }}
        >
          &ldquo;Talent gets noticed. Presence gets hired.&rdquo;
        </motion.p>

        {/* Get Started CTA */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 1.3, type: "spring", stiffness: 170 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowLogin(true)}
          className="relative overflow-hidden font-bold uppercase"
          style={{
            marginTop:      "2rem",
            padding:        "0.72rem 2.4rem",
            borderRadius:   "9999px",
            fontSize:       "clamp(0.6rem, 1.1vw, 0.74rem)",
            letterSpacing:  "0.22em",
            background:     "rgba(255,255,255,0.06)",
            border:         "1px solid rgba(255,255,255,0.28)",
            backdropFilter: "blur(10px)",
            boxShadow:      "0 0 18px rgba(200,225,255,0.1), inset 0 1px 0 rgba(255,255,255,0.1)",
            color:          "rgba(255,255,255,0.88)",
          }}
        >
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.1), transparent)" }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <span className="relative">✦ Get Started</span>
        </motion.button>
      </div>

      {/* ── Login Modal ── */}
      {showLogin && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 20, backdropFilter: "blur(8px)" }}
          onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="w-[400px] text-center"
            style={{
              background:     "rgba(2,0,10,0.96)",
              backdropFilter: "blur(40px)",
              border:         "1px solid rgba(255,255,255,0.1)",
              borderRadius:   "1.5rem",
              boxShadow:      "0 0 50px rgba(150,200,255,0.1), 0 30px 60px rgba(0,0,0,0.85)",
              padding:        "2.5rem",
            }}
          >
            <h2
              className="font-black uppercase mb-1"
              style={{ fontSize: "1.05rem", letterSpacing: "0.22em" }}
            >
              LOGIN TO BLACKBOX.AI
            </h2>
            <p
              className="text-xs tracking-widest mb-7"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Your interview journey begins here
            </p>

            {/* Google */}
            <button
              onClick={() => handleOAuthLogin(new GoogleAuthProvider())}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-full font-semibold mb-3 transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.95)", color: "#111", fontSize: "0.85rem" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {isLoggingIn ? "Signing in…" : "Continue with Google"}
            </button>

            {/* GitHub */}
            <button
              onClick={() => handleOAuthLogin(new GithubAuthProvider())}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-full font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.06)",
                border:     "1px solid rgba(255,255,255,0.15)",
                color:      "#fff",
                fontSize:   "0.85rem",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              {isLoggingIn ? "Signing in…" : "Continue with GitHub"}
            </button>

            <button
              onClick={() => setShowLogin(false)}
              className="mt-5 transition-colors"
              style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.28)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.28)")}
            >
              ← Back
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
