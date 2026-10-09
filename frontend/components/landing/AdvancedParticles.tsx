"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import React from "react";

const PARTICLE_COUNT = 7000;

const SECTION_COLORS = [
  [1.0, 1.0, 1.0],       // Section 0: Pure white
  [0.55, 0.36, 0.96],    // Section 1: Violet
  [0.96, 0.62, 0.04],    // Section 2: Amber
  [0.02, 0.71, 0.83],    // Section 3: Cyan
  [0.85, 0.75, 1.0],     // Section 4: Soft lavender
];

export default function ParticleCanvasAdvanced() {
  const pointsRef = useRef<THREE.Points>(null);
  const { camera } = useThree();

  const positions = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const velocities = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const origins = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const targetOrigins = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const colors = useRef(new Float32Array(PARTICLE_COUNT * 3));
  
  const currentSection = useRef(0);
  const isExploding = useRef(false);
  const explodeTimer = useRef(0);
  
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const mouse3D = useRef(new THREE.Vector3());
  const [isMouseInCanvas, setIsMouseInCanvas] = useState(false);

  // Precompute all 5 formations
  const formations = useMemo(() => {
    const form0 = new Float32Array(PARTICLE_COUNT * 3); // Sphere
    const form1 = new Float32Array(PARTICLE_COUNT * 3); // DNA Helix
    const form2 = new Float32Array(PARTICLE_COUNT * 3); // Orbital Clusters
    const form3 = new Float32Array(PARTICLE_COUNT * 3); // Torus
    const form4 = new Float32Array(PARTICLE_COUNT * 3); // Aurora Wave

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // FORMATION 0 — SPHERE (Fibonacci sphere)
      const phi = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      form0[i3] = Math.cos(theta) * Math.sin(phi) * 4 + 2.5;
      form0[i3 + 1] = Math.cos(phi) * 4;
      form0[i3 + 2] = Math.sin(theta) * Math.sin(phi) * 4;

      // FORMATION 1 — DNA DOUBLE HELIX
      if (i < PARTICLE_COUNT / 2) {
        const t = (i / (PARTICLE_COUNT / 2)) * Math.PI * 10;
        form1[i3] = Math.cos(t) * 2.2 - 2.5;
        form1[i3 + 1] = (i / (PARTICLE_COUNT / 2)) * 14 - 7;
        form1[i3 + 2] = Math.sin(t) * 2.2;
      } else {
        const j = i - PARTICLE_COUNT / 2;
        const t = (j / (PARTICLE_COUNT / 2)) * Math.PI * 10 + Math.PI;
        form1[i3] = Math.cos(t) * 2.2 - 2.5;
        form1[i3 + 1] = (j / (PARTICLE_COUNT / 2)) * 14 - 7;
        form1[i3 + 2] = Math.sin(t) * 2.2;
      }

      // FORMATION 2 — 6 ORBITAL CLUSTERS
      const clusterIndex = Math.floor((i / PARTICLE_COUNT) * 6);
      const angle = (clusterIndex / 6) * Math.PI * 2;
      const cx = Math.cos(angle) * 3.5 + 2.0;
      const cy = Math.sin(angle) * 3.5;
      const cz = 0;
      
      const localPhi = Math.acos(1 - 2 * Math.random());
      const localTheta = Math.random() * Math.PI * 2;
      form2[i3] = cx + Math.cos(localTheta) * Math.sin(localPhi) * 0.8;
      form2[i3 + 1] = cy + Math.cos(localPhi) * 0.8;
      form2[i3 + 2] = cz + Math.sin(localTheta) * Math.sin(localPhi) * 0.8;

      // FORMATION 3 — FLAT TORUS RING
      const R = 3.0;
      const r = 0.6;
      const t = (i / PARTICLE_COUNT) * Math.PI * 2 * 12;
      const s = (i / PARTICLE_COUNT) * Math.PI * 2;
      form3[i3] = (R + r * Math.cos(s)) * Math.cos(t) - 2.5;
      form3[i3 + 1] = r * Math.sin(s);
      form3[i3 + 2] = (R + r * Math.cos(s)) * Math.sin(t);

      // FORMATION 4 — AURORA WAVE
      form4[i3] = (i / PARTICLE_COUNT) * 24 - 12;
      form4[i3 + 1] = Math.sin(i * 0.015) * 1.8 + Math.sin(i * 0.031) * 0.9;
      form4[i3 + 2] = (Math.random() - 0.5) * 2.0;
    }

    return [form0, form1, form2, form3, form4];
  }, []);

  // Initialize particles
  useEffect(() => {
    const pos = positions.current;
    const vel = velocities.current;
    const ori = origins.current;
    const targOri = targetOrigins.current;
    const col = colors.current;

    // Start with formation 0
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      pos[i3] = formations[0][i3];
      pos[i3 + 1] = formations[0][i3 + 1];
      pos[i3 + 2] = formations[0][i3 + 2];

      ori[i3] = formations[0][i3];
      ori[i3 + 1] = formations[0][i3 + 1];
      ori[i3 + 2] = formations[0][i3 + 2];

      targOri[i3] = formations[0][i3];
      targOri[i3 + 1] = formations[0][i3 + 1];
      targOri[i3 + 2] = formations[0][i3 + 2];

      vel[i3] = 0;
      vel[i3 + 1] = 0;
      vel[i3 + 2] = 0;

      // Initial white color with variation
      const noise = (Math.random() - 0.5) * 0.12;
      col[i3] = 1.0 + noise;
      col[i3 + 1] = 1.0 + noise;
      col[i3 + 2] = 1.0 + noise;
    }

    // Mouse tracking
    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      setIsMouseInCanvas(true);
    };

    const handleMouseLeave = () => {
      setIsMouseInCanvas(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [formations]);

  // Expose triggerExplosion via window for GSAP ScrollTrigger
  useEffect(() => {
    (window as any).triggerExplosion = (nextSection: number) => {
      if (nextSection < 0 || nextSection > 4) return;
      
      currentSection.current = nextSection;
      isExploding.current = true;
      explodeTimer.current = 0;

      // Set target origins to next formation
      const nextForm = formations[nextSection];
      for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
        targetOrigins.current[i] = nextForm[i];
      }

      // Give particles explosion velocities
      const vel = velocities.current;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const angle = Math.random() * Math.PI * 2;
        const elevation = (Math.random() - 0.5) * Math.PI;
        const speed = 0.08 + Math.random() * 0.18;
        
        vel[i3] = Math.cos(angle) * Math.cos(elevation) * speed;
        vel[i3 + 1] = Math.sin(elevation) * speed;
        vel[i3 + 2] = Math.sin(angle) * Math.cos(elevation) * speed;
      }
    };

    return () => {
      delete (window as any).triggerExplosion;
    };
  }, [formations]);

  // Update formation animations
  const updateFormationAnimation = (time: number, section: number) => {
    const ori = origins.current;

    if (section === 1) {
      // DNA HELIX ROTATION
      const rotAngle = 0.008;
      const cos = Math.cos(rotAngle);
      const sin = Math.sin(rotAngle);
      
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const x = ori[i3];
        const z = ori[i3 + 2];
        ori[i3] = x * cos - z * sin;
        ori[i3 + 2] = x * sin + z * cos;
      }
    } else if (section === 2) {
      // ORBITAL CLUSTERS — pulse and orbit
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const clusterIndex = Math.floor((i / PARTICLE_COUNT) * 6);
        const pulse = 1 + 0.04 * Math.sin(time * 1.2 + clusterIndex);
        const orbitOffset = time * 0.004;
        
        ori[i3] *= pulse;
        ori[i3 + 1] *= pulse;
        
        const angle = orbitOffset + (clusterIndex / 6) * Math.PI * 2;
        ori[i3] += Math.cos(angle) * 0.3;
        ori[i3 + 1] += Math.sin(angle) * 0.3;
      }
    } else if (section === 3) {
      // TORUS ROTATION
      const rotAngle = 0.006;
      const cos = Math.cos(rotAngle);
      const sin = Math.sin(rotAngle);
      const wobble = Math.sin(time * 0.8) * 0.15;
      
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const x = ori[i3];
        const z = ori[i3 + 2];
        ori[i3] = x * cos - z * sin;
        ori[i3 + 2] = x * sin + z * cos;
        ori[i3 + 1] += wobble;
      }
    } else if (section === 4) {
      // AURORA WAVE FLOW
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        ori[i3 + 1] = Math.sin(i * 0.015 + time * 0.6) * 1.8
                    + Math.sin(i * 0.031 + time * 0.4) * 0.9;
      }
    }
  };

  // Explosion physics
  const runExplosionPhysics = (timer: number) => {
    const pos = positions.current;
    const vel = velocities.current;
    const targOri = targetOrigins.current;

    if (timer < 40) {
      // PHASE 1 — EXPLODE
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        pos[i3] += vel[i3];
        pos[i3 + 1] += vel[i3 + 1];
        pos[i3 + 2] += vel[i3 + 2];
        
        vel[i3] *= 0.94;
        vel[i3 + 1] *= 0.94;
        vel[i3 + 2] *= 0.94;
      }
    } else if (timer < 70) {
      // PHASE 2 — DRIFT
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        pos[i3] += vel[i3];
        pos[i3 + 1] += vel[i3 + 1];
        pos[i3 + 2] += vel[i3 + 2];
        
        vel[i3] *= 0.88;
        vel[i3 + 1] *= 0.88;
        vel[i3 + 2] *= 0.88;
      }
    } else if (timer < 160) {
      // PHASE 3 — REFORM
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        
        vel[i3] += (targOri[i3] - pos[i3]) * 0.045;
        vel[i3 + 1] += (targOri[i3 + 1] - pos[i3 + 1]) * 0.045;
        vel[i3 + 2] += (targOri[i3 + 2] - pos[i3 + 2]) * 0.045;
        
        vel[i3] *= 0.82;
        vel[i3 + 1] *= 0.82;
        vel[i3 + 2] *= 0.82;
        
        pos[i3] += vel[i3];
        pos[i3 + 1] += vel[i3 + 1];
        pos[i3 + 2] += vel[i3 + 2];
      }
      
      // Update origins to target
      if (timer === 70) {
        for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
          origins.current[i] = targOri[i];
        }
      }
    } else {
      // Explosion complete
      isExploding.current = false;
      explodeTimer.current = 0;
    }
  };

  // Normal physics
  const runNormalPhysics = (time: number) => {
    const pos = positions.current;
    const vel = velocities.current;
    const ori = origins.current;

    // Convert mouse to world coords
    if (isMouseInCanvas) {
      const vector = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5);
      vector.unproject(camera);
      const dir = vector.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      mouse3D.current.copy(camera.position).add(dir.multiplyScalar(distance));
    }

    const REPULSION_RADIUS = 2.5;
    const REPULSION_STRENGTH = 0.010;
    const SPRING_STRENGTH = 0.030;
    const DAMPING = 0.80;
    const MAX_VELOCITY = 0.032;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Breathing
      const breathScale = 1 + 0.06 * Math.sin(time * 0.5 + i * 0.002);
      const tx = ori[i3] * breathScale;
      const ty = ori[i3 + 1] * breathScale;
      const tz = ori[i3 + 2] * breathScale;

      // Mouse repulsion
      if (isMouseInCanvas) {
        const dx = pos[i3] - mouse3D.current.x;
        const dy = pos[i3 + 1] - mouse3D.current.y;
        const dz = pos[i3 + 2] - mouse3D.current.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < REPULSION_RADIUS && dist > 0.01) {
          const force = Math.pow((REPULSION_RADIUS - dist) / REPULSION_RADIUS, 2);
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;

          vel[i3] += nx * force * REPULSION_STRENGTH;
          vel[i3 + 1] += ny * force * REPULSION_STRENGTH;
          vel[i3 + 2] += nz * force * REPULSION_STRENGTH;
        }
      }

      // Spring to breathing target
      vel[i3] += (tx - pos[i3]) * SPRING_STRENGTH;
      vel[i3 + 1] += (ty - pos[i3 + 1]) * SPRING_STRENGTH;
      vel[i3 + 2] += (tz - pos[i3 + 2]) * SPRING_STRENGTH;

      // Damping
      vel[i3] *= DAMPING;
      vel[i3 + 1] *= DAMPING;
      vel[i3 + 2] *= DAMPING;

      // Cap velocity
      const speed = Math.sqrt(vel[i3] ** 2 + vel[i3 + 1] ** 2 + vel[i3 + 2] ** 2);
      if (speed > MAX_VELOCITY) {
        const scale = MAX_VELOCITY / speed;
        vel[i3] *= scale;
        vel[i3 + 1] *= scale;
        vel[i3 + 2] *= scale;
      }

      // Apply velocity
      pos[i3] += vel[i3];
      pos[i3 + 1] += vel[i3 + 1];
      pos[i3 + 2] += vel[i3 + 2];
    }
  };

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const t = clock.getElapsedTime();
    const col = colors.current;

    // Color lerp toward target
    const [tr, tg, tb] = SECTION_COLORS[currentSection.current];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const noise = (Math.random() - 0.5) * 0.02; // Subtle shimmer
      
      col[i3] += (tr - col[i3]) * 0.018 + noise;
      col[i3 + 1] += (tg - col[i3 + 1]) * 0.018 + noise;
      col[i3 + 2] += (tb - col[i3 + 2]) * 0.018 + noise;
    }

    // Update shape animations
    updateFormationAnimation(t, currentSection.current);

    // Run physics
    if (isExploding.current) {
      explodeTimer.current++;
      runExplosionPhysics(explodeTimer.current);
    } else {
      runNormalPhysics(t);
    }

    // Mark dirty
    const geometry = pointsRef.current.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions.current}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={PARTICLE_COUNT}
          array={colors.current}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.018}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
