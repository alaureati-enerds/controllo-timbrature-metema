import type { Metadata } from "next"

import { MobileMenu } from "@/components/mobile-menu"

export const metadata: Metadata = { title: "Menu" }

// Pagina raggiunta dal 5° slot della bottom bar su mobile: la navigazione
// completa (la barra mostra solo le scorciatoie principali). Su desktop si
// continua a usare la sidebar.
export default function MenuPage() {
  return <MobileMenu />
}
