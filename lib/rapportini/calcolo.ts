import type { OrarioLavoroSettingsAdmin } from "@/lib/settings/schema"
import { minutiDaOra, oraDaMinuti } from "@/lib/timbrature/calcolo"
import type { RapportinoRiga } from "@/lib/mysql/rapportini"

// Motore di calcolo PURO (nessun I/O) per il confronto rapportini/timbrature:
// gemello di lib/timbrature/calcolo.ts. Vedi docs/calcolo-timbrature.md per il
// motore delle timbrature vero e proprio; questo modulo resta separato finché
// il confronto non è validato (pagina /admin/rapportini).

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

export type RiepilogoGiorno = {
  lavoroMinuti: number
  viaggioMinuti: number
  pernottamento: boolean
}

/**
 * Somma le righe di rapportino di UN giorno. Più rapportini nello stesso
 * giorno (frequente) si sommano; il pernotto è true se almeno una riga lo
 * segnala.
 */
export function sommaGiorno(righe: RapportinoRiga[]): RiepilogoGiorno {
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

export type OreSplit = {
  ordinario: number
  straordinarioLavoro: number
  straordinarioViaggio: number
  totale: number
}

/**
 * Split ordinario/straordinario. Il LAVORO riempie per primo la capacità
 * ordinaria (`minutiOrdinari`), il VIAGGIO riempie quanto resta della
 * capacità; oltre, ciascuno genera straordinario della propria categoria
 * (pagate separatamente). Vedi gli esempi numerici in
 * docs/calcolo-timbrature.md → confronto rapportini (o il piano della
 * feature): 8h lavoro + 2h viaggio → 8 ordinario + 2 straord. viaggio; 6h
 * lavoro + 2h viaggio → 8 ordinario; 10h lavoro + 1h viaggio → 8 ordinario +
 * 2 straord. lavoro + 1 straord. viaggio.
 */
export function calcolaOreSplit(
  lavoroMinuti: number,
  viaggioMinuti: number,
  minutiOrdinari: number
): OreSplit {
  const ordinarioLavoro = Math.min(lavoroMinuti, minutiOrdinari)
  const straordinarioLavoro = Math.max(lavoroMinuti - minutiOrdinari, 0)
  const capacitaResidua = minutiOrdinari - ordinarioLavoro
  const ordinarioViaggio = Math.min(viaggioMinuti, capacitaResidua)
  const straordinarioViaggio = viaggioMinuti - ordinarioViaggio

  return {
    ordinario: ordinarioLavoro + ordinarioViaggio,
    straordinarioLavoro,
    straordinarioViaggio,
    totale: lavoroMinuti + viaggioMinuti,
  }
}

export type OrarioRicostruito = {
  entrata1: string | null
  uscita1: string | null
  entrata2: string | null
  uscita2: string | null
}

/**
 * Ricostruisce entrata/uscita a partire dal totale di minuti (lavoro +
 * viaggio) del rapportino, riempiendo l'orario standard dal primo ingresso:
 * prima il mattino, poi il pomeriggio, oltre estende l'uscita serale (unico
 * modo di rappresentare lo straordinario con soli 4 slot). Non inventa mai
 * un'entrata prima di `primoIngresso`.
 */
export function costruisciOrario(
  totaleMinuti: number,
  orario: OrarioLavoroSettingsAdmin
): OrarioRicostruito {
  if (totaleMinuti <= 0) {
    return { entrata1: null, uscita1: null, entrata2: null, uscita2: null }
  }

  const inizioMattina = minutiDaOra(orario.primoIngresso)
  const fineMattina = minutiDaOra(orario.primaUscita)
  const inizioPomeriggio = minutiDaOra(orario.secondoIngresso)

  const capacitaMattina = Math.max(fineMattina - inizioMattina, 0)

  if (totaleMinuti <= capacitaMattina) {
    return {
      entrata1: orario.primoIngresso,
      uscita1: oraDaMinuti(inizioMattina + totaleMinuti),
      entrata2: null,
      uscita2: null,
    }
  }

  // Il resto occupa il pomeriggio da `secondoIngresso`: se `restante` supera
  // la capacità standard del pomeriggio, `uscita2` supera naturalmente
  // `secondaUscita` (è lo straordinario), senza bisogno di un clamp esplicito.
  const restante = totaleMinuti - capacitaMattina
  return {
    entrata1: orario.primoIngresso,
    uscita1: orario.primaUscita,
    entrata2: orario.secondoIngresso,
    uscita2: oraDaMinuti(inizioPomeriggio + restante),
  }
}
