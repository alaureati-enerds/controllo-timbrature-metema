import type { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Pagina inesistente",
}

// Pagina di test: invoca notFound() per innescare il boundary not-found.tsx
// più vicino (app/(dashboard)/not-found.tsx).
export default function NonTrovatoTestPage() {
  notFound()
}
