"use client";

import { useEffect, useRef } from "react";

// ─── GLSL Shaders ──────────────────────────────────────────────────────────────

const STAR_VERT = `
attribute float aSize;
attribute float aPhase;
attribute float aFreq;
uniform float uTime;
varying float vAlpha;
varying float vTemp;
void main() {
  float twinkle = 0.55 + 0.45 * sin(uTime * aFreq + aPhase);
  vAlpha = twinkle;
  vTemp = aPhase;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * twinkle * (420.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const STAR_FRAG = `
varying float vAlpha;
varying float vTemp;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float a = pow(1.0 - d * 2.0, 1.8) * vAlpha;
  float t = mod(vTemp, 3.14);
  vec3 col = t < 1.0 ? vec3(0.82, 0.88, 1.00)
           : t < 2.0 ? vec3(1.00, 0.98, 0.92)
                     : vec3(0.94, 0.96, 1.00);
  gl_FragColor = vec4(col, a);
}`;

const UV_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ── Gargantua Accretion Disk ──
const DISK_FRAG = `
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {
  float v=0.0,a=0.5;
  for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.1+vec2(1.7,9.2);a*=0.5;}
  return v;
}

void main() {
  vec2 uv = vUv - 0.5;
  float r = length(uv);
  float angle = atan(uv.y, uv.x);
  float inner = 0.178, outer = 0.490;
  if (r < inner || r > outer) discard;

  float t = (r - inner) / (outer - inner);

  // Swirling orbital motion
  float angVel = 0.72 / (r * 2.5 + 0.28);
  float rot = angle - uTime * angVel;
  vec2 nc = vec2(cos(rot)*r*6.2, sin(rot)*r*6.2) + uTime * 0.032;
  float n = fbm(nc);

  // Doppler beaming — approaching side is dramatically brighter
  float doppler = pow(0.44 + 0.56 * cos(angle - 0.28), 3.5);

  float edgeFade = smoothstep(0.0, 0.022, r - inner) * smoothstep(0.0, 0.028, outer - r);
  float radFade  = pow(1.0 - t, 2.4);
  float intensity = radFade * edgeFade * (0.60 + 0.40 * n);

  // Gargantua palette — pure white inner, cool silver-grey outer
  vec3 c1 = vec3(1.00, 1.00, 1.00);
  vec3 c2 = vec3(0.91, 0.94, 1.00);
  vec3 c3 = vec3(0.75, 0.79, 0.90);
  vec3 color = t < 0.40 ? mix(c1, c2, t / 0.40) : mix(c2, c3, (t - 0.40) / 0.60);

  float alpha = intensity * (0.35 + 0.65 * doppler);
  if (alpha < 0.005) discard;
  gl_FragColor = vec4(color * (1.0 + doppler * 1.5), alpha);
}`;

// ── Photon Ring (billboarded — creates the iconic lensed arc over the top) ──
const PHOTON_RING_FRAG = `
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 uv = vUv - 0.5;
  float r = length(uv);
  float angle = atan(uv.y, uv.x);
  float ringR = 0.196, hw = 0.013;
  float d = abs(r - ringR) / hw;
  if (d > 1.0) discard;
  float bright = pow(1.0 - d, 4.2);
  // Slight Doppler asymmetry
  float asym = 0.66 + 0.34 * sin(angle - 0.55);
  float shimmer = 0.93 + 0.07 * sin(angle * 22.0 + uTime * 7.0);
  float alpha = bright * asym * shimmer * 0.98;
  if (alpha < 0.007) discard;
  gl_FragColor = vec4(0.97, 0.98, 1.00, alpha);
}`;

// ── Outer Gravitational Halo ──
const HALO_FRAG = `
varying vec2 vUv;
void main() {
  vec2 uv = vUv - 0.5;
  float r = length(uv);
  float a = exp(-r * 5.8) * 0.18;
  if (a < 0.002) discard;
  float t = clamp(r * 3.5, 0.0, 1.0);
  vec3 col = mix(vec3(0.88, 0.92, 1.0), vec3(0.55, 0.68, 0.95), t);
  gl_FragColor = vec4(col, a);
}`;

// ── Nebula Background Clouds ──
const NEBULA_FRAG = `
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.1;a*=0.5;} return v; }
void main(){
  vec2 uv = vUv - 0.5;
  float r = length(uv);
  if (r > 0.5) discard;
  vec2 np = uv * 3.0 + vec2(uTime * 0.016, uTime * 0.008);
  float n  = fbm(np);
  float n2 = fbm(np + 1.73);
  float n3 = fbm(np * 1.4 + vec2(3.14, 2.72));
  float a = n * max(0.0, 1.0 - r * 2.0) * 0.18;
  if (a < 0.003) discard;
  vec3 c1 = vec3(0.03, 0.01, 0.15);
  vec3 c2 = vec3(0.01, 0.04, 0.20);
  vec3 c3 = vec3(0.06, 0.02, 0.18);
  vec3 col = mix(mix(c1, c2, n2), c3, n3);
  gl_FragColor = vec4(col, a);
}`;

// ─── Canvas Shooting Stars ─────────────────────────────────────────────────────

function ShootingStarCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    interface S { x:number; y:number; vx:number; vy:number; spd:number; trail:number; life:number; max:number }
    let star: S | null = null;
    let animId: number;
    let lastSpawn = 0;

    const spawn = () => {
      const ang = (12 + Math.random() * 38) * (Math.PI / 180);
      const spd = 9 + Math.random() * 10;
      star = {
        x: Math.random() * c.width * 0.78, y: Math.random() * c.height * 0.48,
        vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd, spd,
        trail: 85 + Math.random() * 130, life: 0, max: 50 + Math.floor(Math.random() * 35),
      };
    };

    const draw = (t: number) => {
      animId = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, c.width, c.height);
      if (t - lastSpawn > 2100 + Math.random() * 600) { spawn(); lastSpawn = t; }
      if (!star) return;
      star.life++;
      const ratio = star.life / star.max;
      const alpha = ratio < 0.15 ? ratio/0.15 : ratio > 0.72 ? 1-(ratio-0.72)/0.28 : 1;
      const nx = star.vx/star.spd, ny = star.vy/star.spd;
      const tx = star.x - nx*star.trail, ty = star.y - ny*star.trail;
      const lg = ctx.createLinearGradient(tx,ty,star.x,star.y);
      lg.addColorStop(0,"rgba(255,255,255,0)");
      lg.addColorStop(0.55,`rgba(195,222,255,${alpha*0.4})`);
      lg.addColorStop(1,`rgba(255,255,255,${alpha})`);
      ctx.save();
      ctx.strokeStyle=lg; ctx.lineWidth=1.8; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(star.x,star.y); ctx.stroke();
      const hg = ctx.createRadialGradient(star.x,star.y,0,star.x,star.y,5);
      hg.addColorStop(0,`rgba(255,255,255,${alpha})`);
      hg.addColorStop(0.45,`rgba(200,228,255,${alpha*0.42})`);
      hg.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(star.x,star.y,5,0,Math.PI*2); ctx.fill();
      ctx.restore();
      star.x+=star.vx; star.y+=star.vy;
      if (star.life >= star.max || star.x > c.width+200 || star.y > c.height+200) star=null;
    };

    setTimeout(spawn, 700);
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:3 }}
    />
  );
}

// ─── Three.js Gargantua Scene ─────────────────────────────────────────────────

export default function SpaceScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const mount = mountRef.current!;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000003, 1);
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 3000);
      // Slightly elevated & offset left so black hole sits in the right portion (hero text is left)
      camera.position.set(-0.8, 0.9, 5.0);
      camera.lookAt(0.5, 0, 0);

      // ── 5000 Twinkling Stars ──
      const N = 5000;
      const sp = new Float32Array(N * 3), ss = new Float32Array(N),
            sph = new Float32Array(N), sf = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), r = 200 + Math.random() * 1200;
        sp[i*3]=r*Math.sin(ph)*Math.cos(th); sp[i*3+1]=r*Math.sin(ph)*Math.sin(th); sp[i*3+2]=r*Math.cos(ph);
        ss[i]  = 0.4 + Math.random() * 3.2;
        sph[i] = Math.random() * Math.PI * 2;
        sf[i]  = 0.3 + Math.random() * 2.8;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
      starGeo.setAttribute("aSize",    new THREE.BufferAttribute(ss, 1));
      starGeo.setAttribute("aPhase",   new THREE.BufferAttribute(sph, 1));
      starGeo.setAttribute("aFreq",    new THREE.BufferAttribute(sf, 1));
      const starUni = { uTime: { value: 0 } };
      scene.add(new THREE.Points(starGeo, new THREE.ShaderMaterial({
        uniforms: starUni, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })));

      // ── Nebula (wide background plane) ──
      const nebUni = { uTime: { value: 0 } };
      const nebMesh = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.ShaderMaterial({
        uniforms: nebUni, vertexShader: UV_VERT, fragmentShader: NEBULA_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      nebMesh.position.z = -8;
      scene.add(nebMesh);

      // ── Gargantua Black Hole Group ──
      const bh = new THREE.Group();
      scene.add(bh);

      // Event horizon — solid black sphere
      bh.add(new THREE.Mesh(
        new THREE.SphereGeometry(0.52, 96, 96),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      ));

      // Accretion disk (nearly flat, Gargantua orientation)
      const diskUni = { uTime: { value: 0 } };
      const disk = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          uniforms: diskUni, vertexShader: UV_VERT, fragmentShader: DISK_FRAG,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        })
      );
      disk.rotation.x = -Math.PI / 2 + 0.07;
      disk.scale.setScalar(2.9);
      bh.add(disk);

      // Second disk layer (slightly different tilt, time offset — adds depth)
      const disk2Uni = { uTime: { value: 0.55 } };
      const disk2 = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          uniforms: disk2Uni, vertexShader: UV_VERT, fragmentShader: DISK_FRAG,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        })
      );
      disk2.rotation.x = -Math.PI / 2 + 0.03;
      disk2.scale.setScalar(2.9);
      bh.add(disk2);

      // Photon ring — billboarded so it creates the iconic arc sweeping OVER the top
      const photonRingUni = { uTime: { value: 0 } };
      const photonRingPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          uniforms: photonRingUni, vertexShader: UV_VERT, fragmentShader: PHOTON_RING_FRAG,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        })
      );
      photonRingPlane.scale.setScalar(2.9);
      bh.add(photonRingPlane);

      // Outer gravitational halo — billboarded
      const haloPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 3),
        new THREE.ShaderMaterial({
          uniforms: {}, vertexShader: UV_VERT, fragmentShader: HALO_FRAG,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      haloPlane.scale.setScalar(2.9);
      bh.add(haloPlane);

      // ── Resize ──
      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", onResize);

      // ── Animate ──
      const clock = new THREE.Clock();
      let animId: number;

      const animate = () => {
        animId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        starUni.uTime.value   = t;
        diskUni.uTime.value   = t;
        disk2Uni.uTime.value  = t + 0.55;
        photonRingUni.uTime.value = t;
        nebUni.uTime.value    = t;

        // Billboard photon ring & halo to always face camera → creates the lensed arc over the top
        photonRingPlane.quaternion.copy(camera.quaternion);
        haloPlane.quaternion.copy(camera.quaternion);

        // Subtle cinematic camera drift
        camera.position.x = -0.8 + Math.sin(t * 0.028) * 0.10;
        camera.position.y =  0.9 + Math.cos(t * 0.042) * 0.07;
        camera.lookAt(0.5, 0, 0);

        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      };
    })();

    return () => cleanup();
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, background: "#000003" }}
    >
      <ShootingStarCanvas />
    </div>
  );
}
