import { ApiError } from "@/lib/api"
import { getDipendente, type Dipendente } from "@/lib/mysql/timbrature"
import { prisma } from "@/lib/prisma"
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
export type RigaStampa = Giornata & GiornataCalcolata & { weekend: boolean }

export type DatiStampa = {
  dipendente: Dipendente
  mese: number // 1-12
  anno: number
  righe: RigaStampa[]
  totali: { totale: number; ordinario: number; straordinario: number }
  /** Momento della generazione: finisce nel piè di pagina («Stampato il …»). */
  stampatoIl: Date
}

export async function getDatiStampa(
  codiceDipendente: string,
  mese: number,
  anno: number
): Promise<DatiStampa> {
  const dal = `${anno}-${String(mese).padStart(2, "0")}-01`
  const al = `${anno}-${String(mese).padStart(2, "0")}-31`

  const [dipendente, { giornate, orario, regole }, correzioni] = await Promise.all([
    getDipendente(codiceDipendente).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : "errore sconosciuto"
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
      },
    }),
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

  const righe: RigaStampa[] = giornate.map((g) => ({
    ...g,
    ...calcolaCorretti(g, override.get(g.giorno), regole, orario),
    weekend: isWeekend(g.giornoSettimana),
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
