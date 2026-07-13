import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns"

import { ApiError } from "@/lib/api"
import { getPresenze } from "@/lib/mysql/timbrature"
import { getOrarioSettingsForAdmin } from "@/lib/settings/orario"
import type { OrarioLavoroSettingsAdmin } from "@/lib/settings/schema"
import { minutiDaOra } from "@/lib/timbrature/calcolo"

// Costruzione delle GIORNATE di un mese a partire dalle timbrature grezze del
// marcatempo (MySQL aziendale, sola lettura). È il dato "reale", prima di
// qualsiasi correzione: la sovrapposizione delle correzioni avviene in
// lib/timbrature/calcolo.ts. Usata sia dalla GET della pagina
// (app/api/admin/timbrature/) sia dalla stampa PDF.

export type Giornata = {
  giorno: string // YYYY-MM-DD
  giornoSettimana: number // 0=dom 6=sab
  entrata1: string | null
  uscita1: string | null
  entrata2: string | null
  uscita2: string | null
  totaleMinuti: number
}

/**
 * Assegna i turni (entrata1/uscita1, entrata2/uscita2) dalle timbrature
 * grezze. Per ogni finestra (mattina / pomeriggio) scandisce le timbrature
 * in ordine e assegna:
 *
 * - Prima E → entrata della finestra
 * - Prima U dopo la prima E → uscita della finestra
 * - Se non c'è E ma c'è una U → uscita della finestra (senza entrata)
 * - Entrata e uscita sono indipendenti: si può avere solo l'una o solo l'altra
 *
 * Il tipo E/U non viene mai alterato. Timbrature in eccedenza ignorate.
 */
function assegnaTurni(
  timbrature: { ora: string; tipologia: string }[],
  orario: OrarioLavoroSettingsAdmin
) {
  // Punto di separazione tra finestra mattino e pomeriggio
  const separazione = Math.floor(
    (minutiDaOra(orario.primaUscita) + minutiDaOra(orario.secondoIngresso)) / 2
  )

  // Separa per finestra
  const mattino = timbrature.filter((t) => minutiDaOra(t.ora) < separazione)
  const pom = timbrature.filter((t) => minutiDaOra(t.ora) >= separazione)

  // Assegna una finestra: entrata → prima E, uscita → prima U dopo la prima E
  function assegna(lista: { ora: string; tipologia: string }[]): {
    entrata: string | null
    uscita: string | null
  } {
    let entrata: string | null = null
    let uscita: string | null = null

    for (const t of lista) {
      if (t.tipologia === "E" && !entrata) {
        entrata = t.ora
      } else if (t.tipologia === "U" && !uscita && entrata) {
        // U dopo la prima E
        if (minutiDaOra(t.ora) > minutiDaOra(entrata)) {
          uscita = t.ora
        }
      }
    }

    // Se non c'è E ma c'è una U, segna l'uscita (indipendente)
    if (!entrata) {
      const primaU = lista.find((t) => t.tipologia === "U")
      if (primaU) uscita = primaU.ora
    }

    return { entrata, uscita }
  }

  const t1 = assegna(mattino)
  const t2 = assegna(pom)

  let totaleMinuti = 0
  if (t1.entrata && t1.uscita) {
    totaleMinuti += minutiDaOra(t1.uscita) - minutiDaOra(t1.entrata)
  }
  if (t2.entrata && t2.uscita) {
    totaleMinuti += minutiDaOra(t2.uscita) - minutiDaOra(t2.entrata)
  }

  return {
    entrata1: t1.entrata,
    uscita1: t1.uscita,
    entrata2: t2.entrata,
    uscita2: t2.uscita,
    totaleMinuti,
  }
}

/**
 * Giornate di un dipendente per un mese (1-12): una riga per OGNI giorno del
 * mese, anche senza timbrature. Se il MySQL aziendale non è raggiungibile
 * lancia un ApiError 502 (il dato è esterno: non è un errore nostro).
 */
export async function getGiornate(
  dipendente: string,
  mese: number,
  anno: number
): Promise<{ giornate: Giornata[]; orario: OrarioLavoroSettingsAdmin }> {
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
  const perGiorno = new Map<string, { ora: string; tipologia: string }[]>()
  for (const p of presenze) {
    const arr = perGiorno.get(p.data) ?? []
    arr.push({ ora: p.ora, tipologia: p.tipologia })
    perGiorno.set(p.data, arr)
  }

  const orario = await getOrarioSettingsForAdmin()

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
      ...assegnaTurni(ordinate, orario),
    }
  })

  return { giornate, orario }
}
