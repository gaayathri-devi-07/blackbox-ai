import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function contentSecurityPolicy({ blobScripts = false } = {}) {
  return [
    "default-src 'self'",
    // Firebase Auth popups/reCAPTCHA need Google script origins. MediaPipe and ONNX
    // Runtime load their WASM runtimes from jsDelivr ('unsafe-eval' covers WebAssembly).
    // The interview room additionally allows blob: scripts: multi-threaded ONNX Runtime
    // starts its worker threads from same-origin blob URLs.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'${blobScripts ? " blob:" : ""} https://apis.google.com https://www.gstatic.com https://www.google.com https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://avatars.githubusercontent.com",
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      "https://*.googleapis.com",
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://cdn.jsdelivr.net",
      "https://storage.googleapis.com",
      // On-device Whisper transcription downloads its model files from Hugging Face.
      "https://huggingface.co",
      "https://*.huggingface.co",
      "https://*.hf.co",
      isDev ? "ws://localhost:* http://localhost:*" : "",
    ].filter(Boolean).join(" "),
    "media-src 'self' blob:",
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://www.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    isDev ? "" : "upgrade-insecure-requests",
  ].filter(Boolean).join("; ");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
];

const nextConfig: NextConfig = {
  headers: async () => [
    { source: "/(.*)", headers: securityHeaders },
    // The interview room runs Whisper in WebAssembly. Cross-origin isolation enables
    // SharedArrayBuffer, so the model can use several CPU threads. "credentialless"
    // keeps CDN and model downloads working without extra CORP headers.
    {
      source: "/interview/session",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        { key: "Content-Security-Policy", value: contentSecurityPolicy({ blobScripts: true }) },
      ],
    },
    // Workers spawned by that page need a matching embedder policy.
    { source: "/_next/static/:path*", headers: [{ key: "Cross-Origin-Embedder-Policy", value: "credentialless" }] },
  ],
  poweredByHeader: false,
  images: { qualities: [75, 85] },
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (set in the Dockerfile; not
  // needed on Vercel, and Windows can't copy some traced chunk names).
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // pg ships optional native bindings; keep it out of the server bundle.
  serverExternalPackages: ["pg", "langsmith", "@huggingface/transformers", "onnxruntime-node"],
  async redirects() {
    return [
      // Routes consolidated during the redesign — keep old links working.
      { source: "/landing", destination: "/login", permanent: true },
      { source: "/auth", destination: "/onboarding", permanent: true },
      { source: "/career", destination: "/onboarding", permanent: true },
      { source: "/companion", destination: "/onboarding", permanent: true },
      { source: "/journey", destination: "/home", permanent: false },
      { source: "/journey/mock", destination: "/interview/setup", permanent: true },
      { source: "/journey/mock/:path*", destination: "/interview/setup", permanent: true },
    ];
  },
};

export default nextConfig;
