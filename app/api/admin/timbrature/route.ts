import { z } from "zod"

import { ApiError, ok, safeHandler } from "@/lib/api"
import { requireSettingsPermission } from "@/lib/settings/authz"
import { getPresenze } from "@/lib/mysql/timbrature"
import { getOrarioSettingsForAdmin } from "@/lib/settings/orario"
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns"

const paramsSchema = z.object({
  dipendente: z.string().min(1),
  mese: z.coerce.number().int().min(1).max(12),
  anno: z.coerce.number().int().min(2000).max(2100),
})

function parseOra(orario: string): { h: number; m: number } {
  const [h, m] = orario.split(":").map(Number)
  return { h, m }
}

function minutiFromOra(ora: string): number {
  const { h, m } = parseOra(ora)
  return h * 60 + m
}

function formattaOra(minuti: number): string {
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
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
  orario: { primoIngresso: string; primaUscita: string; secondoIngresso: string; secondaUscita: string }
) {
  let entrata1: string | null = null
  let uscita1: string | null = null
  let entrata2: string | null = null
  let uscita2: string | null = null

  // Punto di separazione tra finestra mattino e pomeriggio
  const separazione = Math.floor(
    (minutiFromOra(orario.primaUscita) + minutiFromOra(orario.secondoIngresso)) / 2
  )

  // Separa per finestra
  const mattino = timbrature.filter((t) => minutiFromOra(t.ora) < separazione)
  const pom = timbrature.filter((t) => minutiFromOra(t.ora) >= separazione)

  // Assegna una finestra: entrata → prima E, uscita → prima U dopo la prima E
  function assegna(
    lista: { ora: string; tipologia: string }[]
  ): { entrata: string | null; uscita: string | null } {
    let entrata: string | null = null
    let uscita: string | null = null

    for (const t of lista) {
      if (t.tipologia === "E" && !entrata) {
        entrata = t.ora
      } else if (t.tipologia === "U" && !uscita && entrata) {
        // U dopo la prima E
        if (minutiFromOra(t.ora) > minutiFromOra(entrata)) {
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
  entrata1 = t1.entrata
  uscita1 = t1.uscita

  const t2 = assegna(pom)
  entrata2 = t2.entrata
  uscita2 = t2.uscita

  let totaleMinuti = 0
  if (entrata1 && uscita1) {
    totaleMinuti += minutiFromOra(uscita1) - minutiFromOra(entrata1)
  }
  if (entrata2 && uscita2) {
    totaleMinuti += minutiFromOra(uscita2) - minutiFromOra(entrata2)
  }

  return { entrata1, uscita1, entrata2, uscita2, totaleMinuti }
}

export type Giornata = {
  giorno: string // YYYY-MM-DD
  giornoSettimana: number // 0=dom 6=sab
  entrata1: string | null
  uscita1: string | null
  entrata2: string | null
  uscita2: string | null
  totaleMinuti: number
}

export const GET = safeHandler(async (request) => {
  await requireSettingsPermission("read")

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const { dipendente, mese, anno } = paramsSchema.parse(params)

  const dal = format(new Date(anno, mese - 1, 1), "yyyy-MM-dd")
  const al = format(
    endOfMonth(new Date(anno, mese - 1, 1)),
    "yyyy-MM-dd"
  )

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

  const giorni = eachDayOfInterval({
    start: startOfMonth(new Date(anno, mese - 1)),
    end: endOfMonth(new Date(anno, mese - 1)),
  })

  const giornate: Giornata[] = giorni.map((g) => {
    const key = format(g, "yyyy-MM-dd")
    const timbrature = perGiorno.get(key) ?? []
    const ordinate = [...timbrature].sort(
      (a, b) => minutiFromOra(a.ora) - minutiFromOra(b.ora)
    )

    const { entrata1, uscita1, entrata2, uscita2, totaleMinuti } =
      assegnaTurni(ordinate, orario)

    return {
      giorno: key,
      giornoSettimana: g.getDay(),
      entrata1,
      uscita1,
      entrata2,
      uscita2,
      totaleMinuti,
    }
  })

  return ok({ giornate, orario })
})
