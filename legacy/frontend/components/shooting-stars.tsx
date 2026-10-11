"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ShootingStar {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  trail: THREE.Mesh[];
  life: number;
  maxLife: number;
}

export function ShootingStars() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const stars: ShootingStar[] = [];
    const MAX_STARS = 12;
    const headGeo = new THREE.SphereGeometry(0.025, 8, 8);

    function createShootingStar() {
      const x = (Math.random() - 0.3) * 22;
      const y = Math.random() * 8 + 4;
      const z = (Math.random() - 0.5) * 3;

      const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(x, y, z);
      scene.add(head);

      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5;
      const speed = 0.06 + Math.random() * 0.1;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        -Math.sin(angle) * speed,
        0
      );

      const TRAIL_LEN = 14;
      const trail: THREE.Mesh[] = [];
      for (let i = 0; i < TRAIL_LEN; i++) {
        const r = 0.018 * (1 - i / TRAIL_LEN);
        const tGeo = new THREE.SphereGeometry(Math.max(r, 0.002), 4, 4);
        const tMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.6 + 0.4 * (1 - i / TRAIL_LEN), 0.8, 1.0),
          transparent: true,
          opacity: (1 - i / TRAIL_LEN) * 0.7,
        });
        const tMesh = new THREE.Mesh(tGeo, tMat);
        tMesh.position.copy(head.position);
        scene.add(tMesh);
        trail.push(tMesh);
      }

      const maxLife = 80 + Math.random() * 60;
      stars.push({ mesh: head, velocity, trail, life: 0, maxLife });
    }

    let frame = 0;
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      frame++;

      if (frame % 100 === 0 && stars.length < MAX_STARS) {
        createShootingStar();
      }

      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.life++;

        // Trail follows head
        for (let j = s.trail.length - 1; j > 0; j--) {
          s.trail[j].position.copy(s.trail[j - 1].position);
        }
        if (s.trail.length > 0) s.trail[0].position.copy(s.mesh.position);

        s.mesh.position.add(s.velocity);

        // Fade near end of life
        const lifeRatio = s.life / s.maxLife;
        if (lifeRatio > 0.65) {
          const fade = 1 - (lifeRatio - 0.65) / 0.35;
          (s.mesh.material as THREE.MeshBasicMaterial).opacity = fade;
          s.trail.forEach((t, idx) => {
            (t.material as THREE.MeshBasicMaterial).opacity =
              (1 - idx / s.trail.length) * 0.7 * fade;
          });
        }

        if (
          s.life >= s.maxLife ||
          s.mesh.position.y < -8 ||
          s.mesh.position.x > 16
        ) {
          scene.remove(s.mesh);
          s.trail.forEach((t) => scene.remove(t));
          stars.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Stagger initial stars
    for (let i = 0; i < 4; i++) {
      setTimeout(() => createShootingStar(), i * 600);
    }

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    />
  );
}
