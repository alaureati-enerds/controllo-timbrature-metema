import * as React from "react"

// Rileva la preferenza di sistema "riduci le animazioni" (prefers-reduced-motion)
// sottoscrivendo il media query come external store. SSR-safe: lato server e al
// primo render ritorna false, poi si allinea alla preferenza reale dell'utente.
// Usato per disattivare le animazioni dei grafici quando l'utente le disabilita.

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
