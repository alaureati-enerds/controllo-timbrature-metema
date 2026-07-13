import { arrotondaEntrata, arrotondaUscita } from "@/lib/timbrature/arrotondamento"
import type { Giornata } from "@/lib/timbrature/giornate"

// Calcolo dei valori CORRETTI di una giornata e dei totali del mese. Funzioni
// pure, senza React né accesso al DB: le usano sia la pagina Timbrature
// (components/admin/timbrature-manager.tsx) sia la stampa PDF lato server
// (app/api/admin/timbrature/stampa/), così i numeri a schermo e quelli
// stampati non possono divergere.

/** Minuti dall'inizio della giornata per un orario HH:MM. */
export function minutiDaOra(ora: string): number {
  const [h, m] = ora.split(":").map(Number)
  return h * 60 + m
}

// Soglia oltre la quale le ore di una giornata diventano straordinario.
export const MINUTI_ORDINARI = 480

// Valore corretto di un turno:
// - stringa vuota nell'override = turno azzerato esplicitamente dalla
//   correzione (es. preset senza secondo turno): resta vuoto, NON ricade sul
//   dato reale;
// - valore presente = quello corretto;
// - assente/undefined = nessuna correzione su quel campo: dato reale arrotondato.
function corretto(
  ov: string | null | undefined,
  raw: string | null,
  round: (o: string) => string
): string | null {
  if (ov === "") return null
  if (ov != null) return ov
  return raw ? round(raw) : null
}

export type GiornataCalcolata = {
  ce1: string | null
  cu1: string | null
  ce2: string | null
  cu2: string | null
  totale: number
  ordinario: number
  straordinario: number
}

/** Applica la correzione (se c'è) al dato reale e ne deriva totale/ordinario/straordinario. */
export function calcolaCorretti(
  g: Giornata,
  override?: Record<string, string | null>
): GiornataCalcolata {
  const ce1 = corretto(override?.entrata1, g.entrata1, arrotondaEntrata)
  const cu1 = corretto(override?.uscita1, g.uscita1, arrotondaUscita)
  const ce2 = corretto(override?.entrata2, g.entrata2, arrotondaEntrata)
  const cu2 = corretto(override?.uscita2, g.uscita2, arrotondaUscita)

  const minuti =
    (ce1 && cu1 ? minutiDaOra(cu1) - minutiDaOra(ce1) : 0) +
    (ce2 && cu2 ? minutiDaOra(cu2) - minutiDaOra(ce2) : 0)

  return {
    ce1,
    cu1,
    ce2,
    cu2,
    totale: minuti,
    ordinario: Math.min(minuti, MINUTI_ORDINARI),
    straordinario: Math.max(minuti - MINUTI_ORDINARI, 0),
  }
}

/** Somma dei minuti di tutte le giornate del mese. */
export function calcolaTotaliMese(righe: GiornataCalcolata[]) {
  return {
    totale: righe.reduce((s, r) => s + r.totale, 0),
    ordinario: righe.reduce((s, r) => s + r.ordinario, 0),
    straordinario: righe.reduce((s, r) => s + r.straordinario, 0),
  }
}

/** Sabato o domenica, dal giorno della settimana di una `Giornata` (0=dom, 6=sab). */
export function isWeekend(giornoSettimana: number): boolean {
  return giornoSettimana === 0 || giornoSettimana === 6
}
