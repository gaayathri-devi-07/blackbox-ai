"""
Complete Premium Landing Page Setup
===================================
Run this script to create all landing page components:
  python create-landing-page.py

This will create:
- components/landing/ directory
- All landing page components
- New landing page entry point
"""

import os

BASE = r"C:\Users\gaaya\blackbox-ai"
LANDING_DIR = os.path.join(BASE, "components", "landing")

# Create directory
os.makedirs(LANDING_DIR, exist_ok=True)
print(f"✓ Created directory: {LANDING_DIR}")

# All component files
components = {
    # ============================================================================
    # LOADER COMPONENT
    # ============================================================================
    "Loader.tsx": """'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

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

    const chars = title.innerText.split('');
    title.innerHTML = chars
      .map((char) => `<span style="opacity: 0">${char === ' ' ? '&nbsp;' : char}</span>`)
      .join('');
    const charElements = title.querySelectorAll('span');

    const ctx = gsap.context(() => {
      gsap.to(charElements, {
        opacity: 1,
        duration: 0.05,
        stagger: 0.06,
        ease: 'power2.inOut',
      });

      gsap.to(
        {},
        {
          duration: 1.8,
          delay: 0.4,
          ease: 'power2.inOut',
          onUpdate: function () {
            const prog = Math.round(this.progress() * 100);
            setProgress(prog);
            gsap.set(progressBar, { scaleX: this.progress() });
          },
          onComplete: () => {
            gsap.to(loader, {
              y: '-100vh',
              duration: 0.8,
              ease: 'power3.inOut',
              delay: 0.2,
              onComplete: () => {
                onComplete();
              },
            });
          },
        }
      );
    });

    return () => ctx.revert();
  }, [onComplete]);

  return (
    <div
      ref={loaderRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#080808',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
      }}
    >
      <div
        ref={titleRef}
        style={{
          fontSize: '3rem',
          fontWeight: 900,
          letterSpacing: '0.2em',
          color: '#ffffff',
          textTransform: 'uppercase',
        }}
      >
        BLACKBOX.AI
      </div>

      <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div
          style={{
            width: '100%',
            height: '3px',
            background: 'rgba(108, 99, 255, 0.2)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            ref={progressBarRef}
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #6C63FF 0%, #00F5FF 100%)',
              transformOrigin: 'left',
              transform: 'scaleX(0)',
              borderRadius: '2px',
            }}
          />
        </div>
        <div
          style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.6)',
            textAlign: 'right',
            fontWeight: 500,
          }}
        >
          {progress}%
        </div>
      </div>
    </div>
  );
}
""",

    # ============================================================================
    # CUSTOM CURSOR
    # ============================================================================
    "CustomCursor.tsx": """'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = 0;
    let mouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      gsap.set(dot, { x: mouseX, y: mouseY });
      gsap.to(ring, {
        x: mouseX,
        y: mouseY,
        duration: 0.15,
        ease: 'power2.out',
      });
    };

    const onMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a')
      ) {
        setIsHovering(true);
      }
    };

    const onMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a')
      ) {
        setIsHovering(false);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseenter', onMouseEnter, true);
    document.addEventListener('mouseleave', onMouseLeave, true);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseenter', onMouseEnter, true);
      document.removeEventListener('mouseleave', onMouseLeave, true);
    };
  }, []);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    if (isHovering) {
      gsap.to(dot, { scale: 0, duration: 0.2, ease: 'power2.out' });
      gsap.to(ring, {
        scale: 2.5,
        backgroundColor: 'rgba(108, 99, 255, 0.2)',
        duration: 0.2,
        ease: 'power2.out',
      });
    } else {
      gsap.to(dot, { scale: 1, duration: 0.2, ease: 'power2.out' });
      gsap.to(ring, {
        scale: 1,
        backgroundColor: 'transparent',
        duration: 0.2,
        ease: 'power2.out',
      });
    }
  }, [isHovering]);

  return (
    <>
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          pointerEvents: 'none',
          zIndex: 99999,
          transform: 'translate(-50%, -50%)',
          mixBlendMode: 'difference',
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          width: '32px',
          height: '32px',
          border: '1px solid rgba(108, 99, 255, 0.6)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 99998,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </>
  );
}
""",
}

# Write all files
for filename, content in components.items():
    filepath = os.path.join(LANDING_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✓ Created: {filename}")

print(f"\n✅ Setup complete! Files created in: {LANDING_DIR}")
print("\n📝 Next steps:")
print("1. The components are ready")
print("2. Now create the main landing page sections")
print("3. Update app/page.tsx to use the new landing page")
