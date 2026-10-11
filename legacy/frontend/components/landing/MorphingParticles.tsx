"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface MorphingParticlesProps {
  scrollProgress: number; // 0 to 1
}

const PARTICLE_COUNT = 12000;
const MOBILE_PARTICLE_COUNT = 3000;

export default function MorphingParticles({ scrollProgress }: MorphingParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null!);
  const { viewport, gl } = useThree();
  
  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const particleCount = isMobile ? MOBILE_PARTICLE_COUNT : PARTICLE_COUNT;
  
  // Buffer arrays
  const positions = useRef(new Float32Array(particleCount * 3));
  const colors = useRef(new Float32Array(particleCount * 3));
  const velocities = useRef(new Float32Array(particleCount * 3));
  
  // Current and target formations
  const currentFormation = useRef(new Float32Array(particleCount * 3));
  const targetFormation = useRef(new Float32Array(particleCount * 3));
  const morphProgress = useRef(0);
  const currentSection = useRef(0);
  
  // Generate all 4 formations
  const formations = useMemo(() => {
    // FORMATION 0: Galaxy/Nebula (Hero)
    const galaxy = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const radius = Math.random() * 8 + 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spiralOffset = Math.random() * Math.PI * 2;
      
      galaxy[i3] = radius * Math.sin(phi) * Math.cos(theta + spiralOffset);
      galaxy[i3 + 1] = (Math.random() - 0.5) * 3 + Math.sin(radius * 0.3) * 2;
      galaxy[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta + spiralOffset);
    }
    
    // FORMATION 1: Torus/Ring
    const torus = new Float32Array(particleCount * 3);
    const majorRadius = 5;
    const minorRadius = 2;
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const u = (i / particleCount) * Math.PI * 2 * 6;
      const v = (i / particleCount) * Math.PI * 2 * 3 + Math.random() * 0.2;
      
      torus[i3] = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
      torus[i3 + 1] = minorRadius * Math.sin(v);
      torus[i3 + 2] = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
    }
    
    // FORMATION 2: Asymmetric Sculpture (twisted helix + shards)
    const sculpture = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const t = (i / particleCount) * Math.PI * 8;
      const radius = 3 + Math.sin(t * 0.5) * 2;
      const twist = t * 0.3;
      
      // Helix with random shards
      if (Math.random() > 0.3) {
        sculpture[i3] = Math.cos(t) * radius * (1 + Math.sin(twist) * 0.5);
        sculpture[i3 + 1] = (i / particleCount) * 12 - 6 + Math.sin(t * 2) * 1.5;
        sculpture[i3 + 2] = Math.sin(t) * radius * (1 + Math.cos(twist) * 0.5);
      } else {
        // Random shards shooting out
        const shardAngle = Math.random() * Math.PI * 2;
        const shardDist = Math.random() * 8;
        sculpture[i3] = Math.cos(shardAngle) * shardDist;
        sculpture[i3 + 1] = (Math.random() - 0.5) * 10;
        sculpture[i3 + 2] = Math.sin(shardAngle) * shardDist;
      }
    }
    
    // FORMATION 3: Exploding Orb (sphere that expands/contracts) - LARGER SIZE
    const orb = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const phi = Math.acos(1 - 2 * (i + 0.5) / particleCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const radius = 4.5; // Increased from 3 to 4.5 (50% larger)
      
      orb[i3] = Math.cos(theta) * Math.sin(phi) * radius;
      orb[i3 + 1] = Math.cos(phi) * radius;
      orb[i3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
    }
    
    return [galaxy, torus, sculpture, orb];
  }, [particleCount]);
  
  // Initialize particles
  useEffect(() => {
    // Set initial positions to galaxy formation
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions.current[i3] = formations[0][i3];
      positions.current[i3 + 1] = formations[0][i3 + 1];
      positions.current[i3 + 2] = formations[0][i3 + 2];
      
      currentFormation.current[i3] = formations[0][i3];
      currentFormation.current[i3 + 1] = formations[0][i3 + 1];
      currentFormation.current[i3 + 2] = formations[0][i3 + 2];
      
      // Initial colors: sky blue, purple, indigo (NO WHITE)
      const colorChoice = Math.random();
      if (colorChoice < 0.5) {
        colors.current[i3] = 0.22; // #38BDF8 sky blue
        colors.current[i3 + 1] = 0.74;
        colors.current[i3 + 2] = 0.97;
      } else if (colorChoice < 0.8) {
        colors.current[i3] = 0.49; // #7C3AED purple
        colors.current[i3 + 1] = 0.23;
        colors.current[i3 + 2] = 0.93;
      } else {
        colors.current[i3] = 0.39; // #6366F1 indigo
        colors.current[i3 + 1] = 0.40;
        colors.current[i3 + 2] = 0.95;
      }
    }
  }, [formations, particleCount]);
  
  // Scroll-driven morphing
  useEffect(() => {
    let targetSection = 0;
    if (scrollProgress < 0.25) targetSection = 0;
    else if (scrollProgress < 0.5) targetSection = 1;
    else if (scrollProgress < 0.75) targetSection = 2;
    else targetSection = 3;
    
    if (targetSection !== currentSection.current) {
      currentSection.current = targetSection;
      morphProgress.current = 0;
      
      // Set target formation
      for (let i = 0; i < particleCount * 3; i++) {
        targetFormation.current[i] = formations[targetSection][i];
      }
      
      // Update target colors based on section
      const sectionColors = [
        [[0.22, 0.74, 0.97], [0.49, 0.23, 0.93], [0.39, 0.40, 0.95]], // Section 0: sky blue, purple, indigo
        [[0.39, 0.40, 0.95], [0.22, 0.74, 0.97], [0.49, 0.23, 0.93]], // Section 1: indigo, sky blue, purple
        [[0.55, 0.36, 0.96], [0.02, 0.71, 0.83], [0.22, 0.74, 0.97]], // Section 2: violet, cyan, sky blue
        [[0.77, 0.71, 0.99], [0.87, 0.84, 0.99], [0.66, 0.33, 0.97]], // Section 3: light purple globe
      ];
      
      // Lerp colors
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const colorIdx = Math.floor(Math.random() * 3);
        const targetColor = sectionColors[targetSection][colorIdx];
        // Store target in velocities temporarily (we'll lerp in useFrame)
        velocities.current[i3] = targetColor[0];
        velocities.current[i3 + 1] = targetColor[1];
        velocities.current[i3 + 2] = targetColor[2];
      }
    }
  }, [scrollProgress, formations, particleCount]);
  
  // Animation loop
  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    
    const time = clock.getElapsedTime();
    const pos = positions.current;
    const col = colors.current;
    const curr = currentFormation.current;
    const target = targetFormation.current;
    const vel = velocities.current;
    
    // Morph progress (smooth over 1.5 seconds)
    if (morphProgress.current < 1) {
      morphProgress.current += 0.01; // ~1.67s at 60fps
    }
    const eased = 1 - Math.pow(1 - morphProgress.current, 3); // ease-out cubic
    
    // Update particles
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Lerp positions
      curr[i3] = THREE.MathUtils.lerp(curr[i3], target[i3], 0.03);
      curr[i3 + 1] = THREE.MathUtils.lerp(curr[i3 + 1], target[i3 + 1], 0.03);
      curr[i3 + 2] = THREE.MathUtils.lerp(curr[i3 + 2], target[i3 + 2], 0.03);
      
      // Add breathing/rotation animation
      let breathScale = 1;
      let rotationOffset = 0;
      
      if (currentSection.current === 0) {
        // Galaxy: slow rotation + breathing
        breathScale = 1 + 0.05 * Math.sin(time * 0.3 + i * 0.001);
        rotationOffset = time * 0.05;
      } else if (currentSection.current === 1) {
        // Torus: rotation around Y axis
        rotationOffset = time * 0.08;
      } else if (currentSection.current === 2) {
        // Sculpture: chaotic twist
        breathScale = 1 + 0.03 * Math.sin(time * 0.5 + i * 0.003);
      } else if (currentSection.current === 3) {
        // Orb: pulse effect
        const pulse = 0.5 + 0.5 * Math.sin(time * 1.5);
        breathScale = 0.8 + pulse * 0.4;
      }
      
      // Apply rotation
      const x = curr[i3];
      const z = curr[i3 + 2];
      const cos = Math.cos(rotationOffset);
      const sin = Math.sin(rotationOffset);
      
      pos[i3] = (x * cos - z * sin) * breathScale;
      pos[i3 + 1] = curr[i3 + 1] * breathScale;
      pos[i3 + 2] = (x * sin + z * cos) * breathScale;
      
      // Lerp colors
      col[i3] = THREE.MathUtils.lerp(col[i3], vel[i3], 0.02);
      col[i3 + 1] = THREE.MathUtils.lerp(col[i3 + 1], vel[i3 + 1], 0.02);
      col[i3 + 2] = THREE.MathUtils.lerp(col[i3 + 2], vel[i3 + 2], 0.02);
    }
    
    // Mark buffers as needing update
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions.current}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors.current}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={isMobile ? 0.02 : 0.015}
        vertexColors={true}
        transparent={true}
        opacity={0.8}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
