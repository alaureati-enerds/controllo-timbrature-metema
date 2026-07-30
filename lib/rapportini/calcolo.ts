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

/**
 * Un giorno segnala "rapportino mancante" se il dipendente è soggetto
 * all'obbligo (`richiesto`, configurato dall'admin — vedi
 * lib/rapportini/richiesti.ts), il giorno è feriale e già trascorso (stessa
 * soglia usata per l'anomalia "assente" in calcolo.ts) e non ha un
 * rapportino registrato. Compare anche sui giorni già segnalati "assente"
 * (nessuna timbratura): mancano entrambi gli elementi, e chi rivede deve
 * poterlo vedere per decidere se aggiungere la presenza a mano o
 * sollecitare il rapportino al tecnico.
 */
export function mancaRapportinoObbligatorio(opts: {
  richiesto: boolean
  weekend: boolean
  futuro: boolean
  haRapportino: boolean
}): boolean {
  return opts.richiesto && !opts.weekend && !opts.futuro && !opts.haRapportino
}

/**
 * Un giorno "determinabile automaticamente" (nessuna anomalia dal solo
 * marcatempo, nessuna correzione manuale) segnala uno scostamento eccessivo
 * se la differenza assoluta fra il totale marcatempo puro e il totale
 * rapportino (lavoro+viaggio) supera la soglia configurata.
 * `sogliaMinuti <= 0` disattiva il controllo (stesso pattern di `dedupMinuti`
 * in lib/settings/schema.ts).
 */
export function scostamentoRapportinoEccessivo(opts: {
  totaleMarcatempo: number
  totaleRapportino: number
  sogliaMinuti: number
}): boolean {
  if (opts.sogliaMinuti <= 0) return false
  return Math.abs(opts.totaleMarcatempo - opts.totaleRapportino) > opts.sogliaMinuti
}
