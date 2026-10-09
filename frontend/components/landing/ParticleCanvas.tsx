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

export default function ParticleCanvas() {
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

  // Track mouse movement
  useMemo(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Convert to normalized device coordinates (-1 to +1)
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
  }, []);

  // Animation loop with mouse repulsion
  useFrame((state) => {
    if (!pointsRef.current) return;

    const time = state.clock.elapsedTime;
    const geometry = pointsRef.current.geometry;
    const posAttr = geometry.attributes.position;

    // Convert mouse position to 3D world coordinates
    if (isMouseInCanvas) {
      // Create a raycaster to get mouse position in 3D space
      // We'll project the mouse to a plane at Z=0 in world space
      const vector = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5);
      vector.unproject(camera);
      
      // Direction from camera to mouse position
      const dir = vector.sub(camera.position).normalize();
      
      // Distance to the plane where particles are (approximately Z=0)
      const distance = -camera.position.z / dir.z;
      mouse3D.current.copy(camera.position).add(dir.multiplyScalar(distance));
    }

    // Loop through all particles
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Get original position
      const origX = particleData.originalPositions[i3];
      const origY = particleData.originalPositions[i3 + 1];
      const origZ = particleData.originalPositions[i3 + 2];

      // Apply breathing animation to original position (reduced jiggle)
      const breathScale = 1 + Math.sin(time * 0.3 + i * 0.01) * 0.03;
      const targetX = origX * breathScale;
      const targetY = origY * breathScale;
      const targetZ = origZ * breathScale;

      // Get current position
      let currentX = particleData.currentPositions[i3];
      let currentY = particleData.currentPositions[i3 + 1];
      let currentZ = particleData.currentPositions[i3 + 2];

      // Mouse repulsion force
      if (isMouseInCanvas) {
        const dx = currentX - mouse3D.current.x;
        const dy = currentY - mouse3D.current.y;
        const dz = currentZ - mouse3D.current.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Apply outward force when mouse is close (minimal movement)
        if (distance < mouseRepulsion && distance > 0.01) {
          const force = (mouseRepulsion - distance) / mouseRepulsion;
          const repulsionStrength = force * force * 0.15; // Minimal force

          // Normalize and apply force
          const nx = dx / distance;
          const ny = dy / distance;
          const nz = dz / distance;

          particleData.velocities[i3] += nx * repulsionStrength;
          particleData.velocities[i3 + 1] += ny * repulsionStrength;
          particleData.velocities[i3 + 2] += nz * repulsionStrength;
        }
      }

      // Spring force to return to original position
      const springX = (targetX - currentX) * springStrength;
      const springY = (targetY - currentY) * springStrength;
      const springZ = (targetZ - currentZ) * springStrength;

      particleData.velocities[i3] += springX;
      particleData.velocities[i3 + 1] += springY;
      particleData.velocities[i3 + 2] += springZ;

      // Apply damping (friction) - increased for smoother motion
      particleData.velocities[i3] *= 0.92;
      particleData.velocities[i3 + 1] *= 0.92;
      particleData.velocities[i3 + 2] *= 0.92;

      // Update position with velocity
      currentX += particleData.velocities[i3];
      currentY += particleData.velocities[i3 + 1];
      currentZ += particleData.velocities[i3 + 2];

      // Store updated position
      particleData.currentPositions[i3] = currentX;
      particleData.currentPositions[i3 + 1] = currentY;
      particleData.currentPositions[i3 + 2] = currentZ;

      // Set position in geometry
      posAttr.setXYZ(i, currentX, currentY, currentZ);
    }

    // Mark positions as needing update
    posAttr.needsUpdate = true;

    // Very slow rotation (reduced for stability)
    pointsRef.current.rotation.y = time * 0.02;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particleData.currentPositions}
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
