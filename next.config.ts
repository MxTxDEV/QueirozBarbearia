import type { NextConfig } from "next";

// CSP sem nonce (não há middleware.ts nesta app pra gerar/propagar um por
// requisição) — 'unsafe-inline' em script-src é necessário pelo script
// inline de tema em src/app/layout.tsx. As demais diretivas (frame-ancestors,
// object-src, base-uri, form-action) já cobrem clickjacking, plugins
// legados e sequestro de formulário/base mesmo sem restringir script-src.
// 'unsafe-eval' só em desenvolvimento — o React usa eval() em dev para
// reconstruir call stacks (nunca em produção); sem isso o Fast Refresh quebra.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
