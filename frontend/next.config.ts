import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Download-Options", value: "noopen" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Added blob: for Three.js texture loading and canvas operations
      "img-src 'self' data: blob: https://*.googleapis.com https://*.firebasestorage.app https://*.googleusercontent.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://generativelanguage.googleapis.com https://identitytoolkit.googleapis.com wss://*.firebaseio.com",
      "media-src 'self' blob:",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
      // blob: is critical — Three.js/R3F creates workers from blob URLs for shader compilation
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],

  poweredByHeader: false,
  reactStrictMode: true,

  // ─── Turbopack configuration (Next.js 16+) ─────────────────────────────────
  // Empty config silences webpack/turbopack migration warning
  turbopack: {},

  // ─── Three.js / R3F / GSAP optimizations ───────────────────────────────────
  experimental: {
    // Tree-shake these heavy packages at build time — cuts bundle size ~40%
    optimizePackageImports: [
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "@react-three/postprocessing",
      "gsap",
    ],
  },

  webpack: (config, { isServer }) => {
    // Three.js uses a lot of browser-only globals — exclude from server bundle
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "@react-three/postprocessing",
      ];
    }

    // Allow importing raw GLSL shader files as strings
    // Usage: import vertexShader from './shaders/vertex.glsl'
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: ["raw-loader", "glslify-loader"],
      type: "javascript/auto",
    });

    // Silence the "Critical dependency: require function is used" warning
    // that Three.js triggers in some webpack versions
    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    return config;
  },
};

export default nextConfig;