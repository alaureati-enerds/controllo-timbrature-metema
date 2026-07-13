import type { NextConfig } from "next"

// Header di sicurezza per la PWA: globali su tutte le rotte + specifici per il
// service worker (che non deve mai essere cached, altrimenti gli update non si
// propagano). Vedi docs/pwa.md.
async function headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
    {
      source: "/sw.js",
      headers: [
        {
          key: "Content-Type",
          value: "application/javascript; charset=utf-8",
        },
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self'",
        },
      ],
    },
  ]
}

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  // Generatore PDF (stampa del registro presenze): gira SOLO nel route handler
  // e non va bundlato da webpack/turbopack — usa binari/wasm propri.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Origini ammesse per gli asset di sviluppo quando si accede al dev server
  // da un dispositivo diverso (es. smartphone via IP del PC sulla LAN).
  allowedDevOrigins: [
    "192.168.1.*",
    "192.168.0.*",
    "10.0.0.*",
    "192.168.178.*",
  ],
  headers,
}

export default nextConfig
