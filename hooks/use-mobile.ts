import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Sottoscrive ai cambi di viewport tramite matchMedia. Usato da
// useSyncExternalStore, l'idioma React per leggere uno stato "esterno" (qui la
// larghezza della finestra) senza un useEffect che chiami setState al mount.
function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    // Snapshot lato client: la larghezza reale della finestra.
    () => window.innerWidth < MOBILE_BREAKPOINT,
    // Snapshot lato server (nessuna finestra): default non-mobile.
    () => false
  )
}
