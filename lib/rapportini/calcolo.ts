import type { RiepilogoRapportino } from "@/lib/timbrature/calcolo"
import type { RapportinoRiga } from "@/lib/mysql/rapportini"

// Raggruppamento e somma delle righe di rapportino (assistenza tecnica,
// tabella `cmd` del MySQL aziendale). Lo split ordinario/straordinario e la
// ricostruzione dell'orario sono nel motore vero e proprio
// (lib/timbrature/calcolo.ts: `calcolaOreSplit`, `costruisciOrario`) perché
// li usa OGNI giorno, con o senza rapportino — qui restano solo le funzioni
// specifiche di `RapportinoRiga[]`.

/** Raggruppa le righe di rapportino per giorno (YYYY-MM-DD). */
export function raggruppaPerGiorno(
  righe: RapportinoRiga[]
): Map<string, RapportinoRiga[]> {
  const out = new Map<string, RapportinoRiga[]>()
  for (const r of righe) {
    const arr = out.get(r.giorno) ?? []
    arr.push(r)
    out.set(r.giorno, arr)
  }
  return out
}

/**
 * Somma le righe di rapportino di UN giorno. Più rapportini nello stesso
 * giorno (frequente) si sommano; il pernotto è true se almeno una riga lo
 * segnala.
 */
export function sommaGiorno(righe: RapportinoRiga[]): RiepilogoRapportino {
  let lavoroMinuti = 0
  let viaggioMinuti = 0
  let pernottamento = false
  for (const r of righe) {
    lavoroMinuti += r.oreLavorazione * 60 + r.minutiLavorazione
    viaggioMinuti += r.oreViaggio * 60 + r.minutiViaggio
    if (r.pernottamento) pernottamento = true
  }
  return { lavoroMinuti, viaggioMinuti, pernottamento }
}
