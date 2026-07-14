import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns"

import { ApiError } from "@/lib/api"
import { getPresenze } from "@/lib/mysql/timbrature"
import { getCalcoloSettingsForAdmin } from "@/lib/settings/calcolo"
import { getOrarioSettingsForAdmin } from "@/lib/settings/orario"
import type {
  CalcoloSettingsAdmin,
  OrarioLavoroSettingsAdmin,
} from "@/lib/settings/schema"
import { minutiDaOra } from "@/lib/timbrature/calcolo"
import { assegnaTurni, type Timbratura } from "@/lib/timbrature/turni"

// Costruzione delle GIORNATE di un mese a partire dalle timbrature grezze del
// marcatempo (MySQL aziendale, sola lettura). È il dato "reale", prima di
// qualsiasi correzione: la sovrapposizione delle correzioni avviene in
// lib/timbrature/calcolo.ts. L'assegnazione dei turni (pura) è in
// lib/timbrature/turni.ts. Usata sia dalla GET della pagina
// (app/api/admin/timbrature/) sia dalla stampa PDF.

export type Giornata = {
  giorno: string // YYYY-MM-DD
  giornoSettimana: number // 0=dom 6=sab
  entrata1: string | null
  uscita1: string | null
  entrata2: string | null
  uscita2: string | null
  totaleMinuti: number
  // Segnali grezzi che servono al calcolo delle anomalie (in calcolo.ts, che
  // gira anche client-side): il conteggio delle timbrature dopo la pulizia e se
  // il giorno conteneva una sentinella 00:00.
  nTimbrature: number
  haSentinella0000: boolean
}

/**
 * Giornate di un dipendente per un mese (1-12): una riga per OGNI giorno del
 * mese, anche senza timbrature. Se il MySQL aziendale non è raggiungibile
 * lancia un ApiError 502 (il dato è esterno: non è un errore nostro).
 *
 * Restituisce anche `orario` e `regole` così che il chiamante (pagina e stampa)
 * possa passarli a `calcolaCorretti`: il calcolo dei corretti gira anche
 * client-side, quindi le regole vanno propagate al browser.
 */
export async function getGiornate(
  dipendente: string,
  mese: number,
  anno: number
): Promise<{
  giornate: Giornata[]
  orario: OrarioLavoroSettingsAdmin
  regole: CalcoloSettingsAdmin
}> {
  const primo = new Date(anno, mese - 1, 1)
  const dal = format(startOfMonth(primo), "yyyy-MM-dd")
  const al = format(endOfMonth(primo), "yyyy-MM-dd")

  let presenze: Awaited<ReturnType<typeof getPresenze>>
  try {
    presenze = await getPresenze(dipendente, dal, al)
  } catch (error) {
    const detail = error instanceof Error ? error.message : "errore sconosciuto"
    throw new ApiError(`Impossibile leggere le presenze: ${detail}`, 502)
  }

  // Raggruppa per data
  const perGiorno = new Map<string, Timbratura[]>()
  for (const p of presenze) {
    const arr = perGiorno.get(p.data) ?? []
    arr.push({ ora: p.ora, tipologia: p.tipologia })
    perGiorno.set(p.data, arr)
  }

  const [orario, regole] = await Promise.all([
    getOrarioSettingsForAdmin(),
    getCalcoloSettingsForAdmin(),
  ])

  const giornate = eachDayOfInterval({
    start: startOfMonth(primo),
    end: endOfMonth(primo),
  }).map((g): Giornata => {
    const key = format(g, "yyyy-MM-dd")
    const ordinate = [...(perGiorno.get(key) ?? [])].sort(
      (a, b) => minutiDaOra(a.ora) - minutiDaOra(b.ora)
    )

    return {
      giorno: key,
      giornoSettimana: g.getDay(),
      ...assegnaTurni(ordinate, orario, regole),
    }
  })

  return { giornate, orario, regole }
}
