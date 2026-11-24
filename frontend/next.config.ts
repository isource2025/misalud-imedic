import type { NextConfig } from "next";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:5010").replace(/\/$/, "");
const isDev = process.env.NODE_ENV !== "production";

const seguridadComun = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** Páginas: no embeber en terceros. PDF/adjuntos de /api se ven vía blob: (no iframe al API). */
const cspPaginas = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-src 'self' blob:",
  "object-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** Respuestas /api: sin frame-ancestors/XFO, si no el visor PDF del link compartido se bloquea. */
const cspApi = [
  "default-src 'none'",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // El navegador solo habla con este origen: /api se reenvía al BFF (Railway), así las cookies de sesión
  // son first-party y pueden ser SameSite=Strict.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [...seguridadComun, { key: "Content-Security-Policy", value: cspApi }],
      },
      {
        source: "/:path*",
        headers: [
          ...seguridadComun,
          { key: "Content-Security-Policy", value: cspPaginas },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
