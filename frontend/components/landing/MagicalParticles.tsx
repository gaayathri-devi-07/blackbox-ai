"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface MagicalParticlesProps {
  count?: number;
  mode?: "exploded" | "asymmetric";
}

export default function MagicalParticles({
  count = 10000,
  mode = "exploded",
}: MagicalParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const [transitionProgress, setTransitionProgress] = useState(0);

  const particleData = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);

    const purpleColor = new THREE.Color("#9333EA"); // Purple

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Random explosion positions
      const explosionRadius = 8 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i3] = explosionRadius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = explosionRadius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = explosionRadius * Math.cos(phi);

      // Random velocities for floating effect
      velocities[i3] = (Math.random() - 0.5) * 0.02;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;

      // Asymmetric target shape (irregular blob)
      if (mode === "asymmetric") {
        const noise = Math.random();
        const radius = 2 + noise * 3 + Math.sin(theta * 3) * 1.5;
        
        targetPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        targetPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta) + Math.sin(noise * 10) * 0.8;
        targetPositions[i3 + 2] = radius * Math.cos(phi) + Math.cos(noise * 8) * 1.2;
      }

      // Purple color
      colors[i3] = purpleColor.r;
      colors[i3 + 1] = purpleColor.g;
      colors[i3 + 2] = purpleColor.b;
    }

    return { positions, colors, velocities, targetPositions };
  }, [count, mode]);

  // Gradual morph to asymmetric shape
  useEffect(() => {
    if (mode === "asymmetric") {
      const interval = setInterval(() => {
        setTransitionProgress((prev) => Math.min(prev + 0.01, 1));
      }, 16);
      return () => clearInterval(interval);
    }
  }, [mode]);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const time = state.clock.elapsedTime;
    const geometry = pointsRef.current.geometry;
    const posAttr = geometry.attributes.position;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      let x = particleData.positions[i3];
      let y = particleData.positions[i3 + 1];
      let z = particleData.positions[i3 + 2];

      if (mode === "exploded") {
        // Floating around randomly
        x += particleData.velocities[i3];
        y += particleData.velocities[i3 + 1];
        z += particleData.velocities[i3 + 2];

        // Gentle drift
        x += Math.sin(time * 0.3 + i * 0.01) * 0.005;
        y += Math.cos(time * 0.2 + i * 0.01) * 0.005;

        particleData.positions[i3] = x;
        particleData.positions[i3 + 1] = y;
        particleData.positions[i3 + 2] = z;
      } else if (mode === "asymmetric") {
        // Morph to target asymmetric shape
        const targetX = particleData.targetPositions[i3];
        const targetY = particleData.targetPositions[i3 + 1];
        const targetZ = particleData.targetPositions[i3 + 2];

        x = THREE.MathUtils.lerp(x, targetX, transitionProgress * 0.05);
        y = THREE.MathUtils.lerp(y, targetY, transitionProgress * 0.05);
        z = THREE.MathUtils.lerp(z, targetZ, transitionProgress * 0.05);

        // Gentle breathing
        const breathScale = 1 + Math.sin(time * 0.2 + i * 0.005) * 0.02;
        x *= breathScale;
        y *= breathScale;
        z *= breathScale;

        particleData.positions[i3] = x;
        particleData.positions[i3 + 1] = y;
        particleData.positions[i3 + 2] = z;
      }

      posAttr.setXYZ(i, x, y, z);
    }

    posAttr.needsUpdate = true;
    
    // Very slow rotation
    pointsRef.current.rotation.y = time * 0.03;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particleData.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particleData.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
