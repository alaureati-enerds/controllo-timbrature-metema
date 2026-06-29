"use client"

import { useEffect } from "react"

// Global error boundary: cattura gli errori che avvengono nel ROOT LAYOUT
// stesso, dove app/error.tsx non può intervenire (è renderizzata dentro il
// layout). Sostituisce l'intero layout, quindi deve renderizzare i propri tag
// <html> e <body> e non può contare su provider, tema o font del layout.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="it">
      <body className="antialiased">
        <main className="grid min-h-svh place-items-center p-6 text-center">
          <div className="flex max-w-sm flex-col items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">
              Qualcosa è andato storto
            </h1>
            <p className="text-muted-foreground text-sm">
              Si è verificato un errore critico. Ricarica la pagina per
              riprovare.
            </p>
            <button
              onClick={reset}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium"
            >
              Ricarica
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
