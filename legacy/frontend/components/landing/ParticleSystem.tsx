"use client";

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

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const radius = 2 + Math.random() * 0.5;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

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
