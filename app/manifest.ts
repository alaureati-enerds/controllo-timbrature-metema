import type { MetadataRoute } from "next"

import { getSystemSettings } from "@/lib/settings/system"

// Manifest dinamico: nome e descrizione si allineano a generateMetadata di
// app/layout.tsx (legge il singleton SystemSetting). Diventa quindi un route
// handler dinamico (usa prisma, API a request-time), coerente con quanto fa
// già il <title> della pagina.
//
// `force-dynamic`: il manifest si genera a OGNI richiesta, mai al build. Così il
// nome riflette subito l'impostazione di sistema E la build dell'immagine Docker
// non richiede un database raggiungibile (vedi docs/deploy-docker.md).
export const dynamic = "force-dynamic"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { appName } = await getSystemSettings()
  const shortName = appName.length > 12 ? appName.slice(0, 12) : appName

  return {
    name: appName,
    short_name: shortName,
    description:
      "Base di partenza full-stack: Next.js + shadcn/ui, backend con Route Handlers e PostgreSQL con Prisma.",
    start_url: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    background_color: "#ffffff",
    theme_color: "#1f1f24",
    lang: "it",
    dir: "ltr",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
