// @ts-nocheck
"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function FluidJiggleSwarm() {
  const count = 10000; // Dense particle count like the video
  const pointsRef = useRef();
  
  // Generate base positions in a dense sphere
  const [positions, basePositions, randomFactors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const randoms = new Float32Array(count); // For asymmetric movement

    for (let i = 0; i < count; i++) {
      // Create a dense core that fades out
      const radius = Math.pow(Math.random(), 1.5) * 3; 
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      pos[i * 3] = base[i * 3] = x;
      pos[i * 3 + 1] = base[i * 3 + 1] = y;
      pos[i * 3 + 2] = base[i * 3 + 2] = z;
      
      randoms[i] = Math.random() * 2 * Math.PI; // Random phase offset
    }
    return [pos, base, randoms];
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    
    const time = state.clock.getElapsedTime() * 0.5;
    const positionsArray = pointsRef.current.geometry.attributes.position.array;
    
    // Convert normalized mouse pointer to 3D space limits
    const mouseX = (state.pointer.x * state.viewport.width) / 2;
    const mouseY = (state.pointer.y * state.viewport.height) / 2;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const bx = basePositions[i3];
      const by = basePositions[i3 + 1];
      const bz = basePositions[i3 + 2];
      const r = randomFactors[i];
      
      // 1. Fluid, Asymmetric Curly Jiggle Math
      // Using sin/cos waves based on position + time + random phase
      const jiggleX = Math.sin(by * 1.5 + time + r) * 0.4 + Math.cos(bz * 2.0 - time) * 0.2;
      const jiggleY = Math.cos(bx * 1.5 + time - r) * 0.4 + Math.sin(bz * 2.0 + time) * 0.2;
      const jiggleZ = Math.sin(bx * 2.0 - time + r) * 0.3 + Math.cos(by * 1.5 + time) * 0.3;
      
      let targetX = bx + jiggleX;
      let targetY = by + jiggleY;
      let targetZ = bz + jiggleZ;
      
      // 2. Aggressive Mouse Repulsion
      const dx = targetX - mouseX;
      const dy = targetY - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 2.5) {
        const force = (2.5 - dist) * 2.0; // Strong scatter force
        targetX += (dx / dist) * force;
        targetY += (dy / dist) * force;
        targetZ += (Math.random() - 0.5) * force; // Scatter in Z axis too
      }
      
      // 3. Smooth Lerp (Interpolation) for fluid movement
      positionsArray[i3] += (targetX - positionsArray[i3]) * 0.08;
      positionsArray[i3 + 1] += (targetY - positionsArray[i3 + 1]) * 0.08;
      positionsArray[i3 + 2] += (targetZ - positionsArray[i3 + 2]) * 0.08;
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Slowly rotate the entire blob
    pointsRef.current.rotation.y = time * 0.2;
    pointsRef.current.rotation.x = Math.sin(time * 0.1) * 0.2;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#c084fc" // Electric bright purple
        transparent
        opacity={0.8}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function ParticleBackground() {
  return (
    <div className="absolute inset-0 z-0 bg-gray-50 dark:bg-black pointer-events-auto cursor-crosshair transition-colors duration-300">
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
        <FluidJiggleSwarm />
      </Canvas>
      {/* Dark vignette so the edges fade perfectly to pitch black */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)] pointer-events-none" />
    </div>
  );
}
