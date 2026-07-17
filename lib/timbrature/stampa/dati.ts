import { endOfMonth, format, startOfMonth } from "date-fns"

import { ApiError } from "@/lib/api"
import { getRapportini, type RapportinoRiga } from "@/lib/mysql/rapportini"
import {
  getDipendente,
  listDipendenti,
  type Dipendente,
} from "@/lib/mysql/timbrature"
import { prisma } from "@/lib/prisma"
import { raggruppaPerGiorno, sommaGiorno } from "@/lib/rapportini/calcolo"
import {
  calcolaCorretti,
  calcolaTotaliMese,
  isWeekend,
  type GiornataCalcolata,
} from "@/lib/timbrature/calcolo"
import { getGiornate, type Giornata } from "@/lib/timbrature/giornate"

// Dati di una stampa: tutto ciò che serve a un template per disegnare il PDF,
// già calcolato. I template sono quindi puri (dati → pagine) e non sanno nulla
// di MySQL, Prisma o correzioni. Il calcolo è lo STESSO della pagina a schermo
// (lib/timbrature/calcolo.ts), così i numeri stampati non possono divergere.

/** Una riga della stampa: dato grezzo (marcatempo) + dato corretto + totali. */
export type RigaStampa = Giornata &
  GiornataCalcolata & { weekend: boolean; revisionata: boolean }

export type DatiStampa = {
  dipendente: Dipendente
  mese: number // 1-12
  anno: number
  righe: RigaStampa[]
  totali: {
    totale: number
    ordinario: number
    straordinario: number
    straordinarioViaggio: number
  }
  /** Momento della generazione: finisce nel piè di pagina («Stampato il …»). */
  stampatoIl: Date
}

export async function getDatiStampa(
  codiceDipendente: string,
  mese: number,
  anno: number
): Promise<DatiStampa> {
  const primo = new Date(anno, mese - 1, 1)
  const dal = format(startOfMonth(primo), "yyyy-MM-dd")
  const al = format(endOfMonth(primo), "yyyy-MM-dd")

  const [
    dipendente,
    { giornate, orario, regole },
    correzioni,
    rapportiniPerGiorno,
  ] = await Promise.all([
    getDipendente(codiceDipendente).catch((error: unknown) => {
      const detail =
        error instanceof Error ? error.message : "errore sconosciuto"
      throw new ApiError(`Impossibile leggere il dipendente: ${detail}`, 502)
    }),
    getGiornate(codiceDipendente, mese, anno),
    prisma.timbraturaCorretta.findMany({
      where: { dipendente: codiceDipendente, giorno: { gte: dal, lte: al } },
      select: {
        giorno: true,
        entrata1: true,
        uscita1: true,
        entrata2: true,
        uscita2: true,
        revisionata: true,
      },
    }),
    // I rapportini sono un'estensione: se il DB esterno non li espone (o la
    // richiesta fallisce) la stampa non deve rompersi, resta senza — stesso
    // comportamento tollerante della pagina a schermo.
    getRapportini(codiceDipendente, dal, al)
      .then(raggruppaPerGiorno)
      .catch(() => new Map<string, RapportinoRiga[]>()),
  ])

  if (!dipendente) throw new ApiError("Dipendente non trovato", 404)

  // Come nella pagina: un campo `null` significa "nessuna correzione", quindi
  // non entra nell'override (il valore ricade sul dato reale arrotondato).
  const override = new Map(
    correzioni.map((c) => [
      c.giorno,
      {
        ...(c.entrata1 !== null && { entrata1: c.entrata1 }),
        ...(c.uscita1 !== null && { uscita1: c.uscita1 }),
        ...(c.entrata2 !== null && { entrata2: c.entrata2 }),
        ...(c.uscita2 !== null && { uscita2: c.uscita2 }),
      },
    ])
  )

  const revisionati = new Set(
    correzioni.filter((c) => c.revisionata).map((c) => c.giorno)
  )
  const righe: RigaStampa[] = giornate.map((g) => ({
    ...g,
    ...calcolaCorretti(
      g,
      override.get(g.giorno),
      regole,
      orario,
      sommaGiorno(rapportiniPerGiorno.get(g.giorno) ?? [])
    ),
    weekend: isWeekend(g.giornoSettimana),
    revisionata: revisionati.has(g.giorno),
  }))

  return {
    dipendente,
    mese,
    anno,
    righe,
    totali: calcolaTotaliMese(righe),
    stampatoIl: new Date(),
  }
}

/**
 * Dati di stampa CUMULATIVA: un `DatiStampa` per ogni dipendente del mese, in
 * ordine alfabetico (l'ordine di `listDipendenti`, che è già `ORDER BY
 * DESCRIZIONE` ed esclude gli obsoleti). Sono esclusi i dipendenti **senza
 * alcuna timbratura corretta** nel mese: il controllo è sui valori corretti
 * (`ce1…cu2`), non sui grezzi, così chi ha solo correzioni manuali compare
 * comunque. La stampa iterata usa le stesse funzioni della singola.
 *
 * Il loop è sequenziale: `getDatiStampa` apre una connessione MySQL per
 * chiamata, e un export on-demand di poche decine di dipendenti resta rapido
 * senza aprire connessioni in parallelo.
 */
export async function getDatiStampaCumulativo(
  mese: number,
  anno: number
): Promise<DatiStampa[]> {
  const dipendenti = await listDipendenti().catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : "errore sconosciuto"
    throw new ApiError(`Impossibile leggere i dipendenti: ${detail}`, 502)
  })

  const risultati: DatiStampa[] = []
  for (const d of dipendenti) {
    const dati = await getDatiStampa(d.codice, mese, anno)
    const haTimbrature = dati.righe.some(
      (r) => r.ce1 || r.cu1 || r.ce2 || r.cu2
    )
    if (haTimbrature) risultati.push(dati)
  }
  return risultati
}
