import type {
  CalcoloSettingsAdmin,
  OrarioLavoroSettingsAdmin,
} from "@/lib/settings/schema"
import {
  arrotondaEntrata,
  arrotondaUscita,
} from "@/lib/timbrature/arrotondamento"
import type { Giornata } from "@/lib/timbrature/giornate"

// Calcolo dei valori CORRETTI di una giornata e dei totali del mese. Funzioni
// pure, senza React né accesso al DB: le usano sia la pagina Timbrature
// (components/admin/timbrature-manager.tsx) sia la stampa PDF lato server
// (app/api/admin/timbrature/stampa/), così i numeri a schermo e quelli
// stampati non possono divergere. Le regole del motore (lib/settings/calcolo.ts)
// e l'orario standard arrivano come parametri.

/** Minuti dall'inizio della giornata per un orario HH:MM. */
export function minutiDaOra(ora: string): number {
  const [h, m] = ora.split(":").map(Number)
  return h * 60 + m
}

// Provenienza di uno slot corretto: la garanzia di onestà del sistema — la UI
// distingue un timbro vero da uno ricostruito.
export type ProvenienzaSlot =
  | "timbrata" // dal dato reale del marcatempo (arrotondato)
  | "corretta" // valore inserito a mano dall'admin
  | "ricostruita" // pausa ricostruita dall'orario standard
  | "assente" // nessun valore

export type Anomalia =
  | "entrata_mancante"
  | "uscita_mancante"
  | "turno_incompleto"
  | "timbratura_sospetta"
  | "durata_eccessiva"
  | "assente"

// Valore corretto di un turno, con la sua provenienza:
// - stringa vuota nell'override = turno azzerato esplicitamente dalla
//   correzione (es. preset senza secondo turno): resta vuoto, NON ricade sul
//   dato reale;
// - valore presente = quello corretto (as-is, non arrotondato);
// - assente/undefined = nessuna correzione: dato reale arrotondato.
function corretto(
  ov: string | null | undefined,
  raw: string | null,
  round: (o: string) => string
): { valore: string | null; origine: ProvenienzaSlot } {
  if (ov === "") return { valore: null, origine: "assente" }
  if (ov != null) return { valore: ov, origine: "corretta" }
  if (raw) return { valore: round(raw), origine: "timbrata" }
  return { valore: null, origine: "assente" }
}

export type GiornataCalcolata = {
  ce1: string | null
  cu1: string | null
  ce2: string | null
  cu2: string | null
  totale: number
  ordinario: number
  straordinario: number
  provenienza: {
    e1: ProvenienzaSlot
    u1: ProvenienzaSlot
    e2: ProvenienzaSlot
    u2: ProvenienzaSlot
  }
  anomalie: Anomalia[]
}

/**
 * Applica overlay, completamento della pausa e ne deriva totale/anomalie.
 *
 * 1. Overlay: `override` > dato reale arrotondato.
 * 2. Completamento (se `pausaAutomatica`): SOLO se la giornata è chiusa ai due
 *    estremi (entrata mattutina + uscita serale) e lo span è sufficiente,
 *    ricostruisce la pausa con gli orari standard. Mai inventare entrata/uscita.
 * 3. Anomalie: segnalate DOPO overlay+fill, così una correzione manuale che
 *    sistema il giorno lo fa sparire dalle anomalie senza codice extra.
 */
export function calcolaCorretti(
  g: Giornata,
  override: Record<string, string | null> | undefined,
  regole: CalcoloSettingsAdmin,
  orario: OrarioLavoroSettingsAdmin
): GiornataCalcolata {
  const roundE = (o: string) => arrotondaEntrata(o, regole)
  const roundU = (o: string) => arrotondaUscita(o, regole)

  // 1. Overlay
  let s1 = corretto(override?.entrata1, g.entrata1, roundE)
  let s2 = corretto(override?.uscita1, g.uscita1, roundU)
  let s3 = corretto(override?.entrata2, g.entrata2, roundE)
  let s4 = corretto(override?.uscita2, g.uscita2, roundU)

  // 2. Completamento della pausa pranzo. Scatta solo su giornata chiusa ai due
  // estremi (ce1 e cu2 presenti); riempie i mancanti fra cu1 (← primaUscita) e
  // ce2 (← secondoIngresso), mai gli estremi. Non tocca gli slot azzerati a mano.
  if (regole.pausaAutomatica && s1.valore != null && s4.valore != null) {
    const span = minutiDaOra(s4.valore) - minutiDaOra(s1.valore)
    if (span >= regole.pausaSpanMinimo) {
      const fillU1 = s2.valore == null && override?.uscita1 !== ""
      const fillE2 = s3.valore == null && override?.entrata2 !== ""
      const nu1 = fillU1 ? orario.primaUscita : s2.valore
      const ne2 = fillE2 ? orario.secondoIngresso : s3.valore

      // Guardia di monotonia: la sequenza risultante deve essere ce1<cu1<ce2<cu2,
      // altrimenti niente fill (es. entrato alle 15: non ricostruire una pausa
      // alle 12:30) e il giorno resta un'anomalia.
      const monotona =
        nu1 != null &&
        ne2 != null &&
        minutiDaOra(s1.valore) < minutiDaOra(nu1) &&
        minutiDaOra(nu1) < minutiDaOra(ne2) &&
        minutiDaOra(ne2) < minutiDaOra(s4.valore)

      if (monotona) {
        if (fillU1) s2 = { valore: orario.primaUscita, origine: "ricostruita" }
        if (fillE2) s3 = { valore: orario.secondoIngresso, origine: "ricostruita" }
      }
    }
  }

  const ce1 = s1.valore
  const cu1 = s2.valore
  const ce2 = s3.valore
  const cu2 = s4.valore

  const minuti =
    (ce1 && cu1 ? minutiDaOra(cu1) - minutiDaOra(ce1) : 0) +
    (ce2 && cu2 ? minutiDaOra(cu2) - minutiDaOra(ce2) : 0)

  // 3. Anomalie
  const anomalie: Anomalia[] = []
  if (g.nTimbrature === 0) {
    // Giorno feriale senza alcuna timbratura; mai nel weekend.
    if (!isWeekend(g.giornoSettimana)) anomalie.push("assente")
  } else if (ce1 == null && ce2 == null) {
    anomalie.push("entrata_mancante")
  } else if (cu1 == null && cu2 == null) {
    anomalie.push("uscita_mancante")
  } else if (!!ce1 !== !!cu1 || !!ce2 !== !!cu2) {
    // Dopo il fill un turno ha un solo estremo.
    anomalie.push("turno_incompleto")
  }
  if (g.haSentinella0000) anomalie.push("timbratura_sospetta")
  if (minuti > regole.oreMassimeGiorno) anomalie.push("durata_eccessiva")

  return {
    ce1,
    cu1,
    ce2,
    cu2,
    totale: minuti,
    ordinario: Math.min(minuti, regole.minutiOrdinari),
    straordinario: Math.max(minuti - regole.minutiOrdinari, 0),
    provenienza: {
      e1: s1.origine,
      u1: s2.origine,
      e2: s3.origine,
      u2: s4.origine,
    },
    anomalie,
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
