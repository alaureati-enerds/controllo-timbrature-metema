import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Errore",
}

// Pagina di test: lancia un errore in fase di render per innescare il
// boundary error.tsx più vicino (app/(dashboard)/error.tsx).
// In sviluppo Next mostra anche l'overlay degli errori sopra al boundary.
export default function ErroreTestPage() {
  throw new Error("Errore simulato dalla pagina di test.")
}
