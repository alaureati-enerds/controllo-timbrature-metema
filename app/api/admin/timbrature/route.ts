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
 * Assegna i turni (entrata1/uscita1, entrata2/uscita2) dalle timbrature grezze
 * scorrendole in ordine cronologico e assegnando ogni timbratura alla finestra
 * oraria corrispondente.
 *
 * ## Algoritmo
 * Per ogni timbratura (in ordine crescente), determino se appartiene alla
 * finestra del mattino o del pomeriggio confrontando l'orario con il punto
 * di separazione (metà strada tra `primaUscita` e `secondoIngresso`).
 * Assegno la timbratura al primo slot libero della finestra: prima entrata,
 * poi uscita. Se lo slot è già occupato, ignoro la timbratura.
 *
 * L'algoritmo è volutamente semplice: non guarda la tipologia E/U, non
 * cerca il matching più vicino, non fa finestre di tolleranza. Ogni
 * timbratura va allo slot successivo della finestra giusta, punto.
 *
 * ## Esempio
 * Finestre: 08:00–12:00 e 14:00–18:00. Separazione = 13:00.
 * Timbrature: E 07:58, U 12:02, E 13:50, U 18:01
 * - 07:58 < 13:00 → mattino → entrata1 = 07:58
 * - 12:02 < 13:00 → mattino → uscita1 = 12:02
 * - 13:50 ≥ 13:00 → pomeriggio → entrata2 = 13:50
 * - 18:01 ≥ 13:00 → pomeriggio → uscita2 = 18:01
 */
function assegnaTurni(
  timbrature: { ora: string; tipologia: string }[],
  orario: { primoIngresso: string; primaUscita: string; secondoIngresso: string; secondaUscita: string }
) {
  let entrata1: string | null = null
  let uscita1: string | null = null
  let entrata2: string | null = null
  let uscita2: string | null = null

  // Punto di separazione tra mattino e pomeriggio: metà strada tra
  // l'uscita del mattino e l'entrata del pomeriggio standard.
  const separazione = Math.floor(
    (minutiFromOra(orario.primaUscita) + minutiFromOra(orario.secondoIngresso)) / 2
  )

  for (const t of timbrature) {
    const m = minutiFromOra(t.ora)

    if (m < separazione) {
      // Mattino
      if (!entrata1) entrata1 = t.ora
      else if (!uscita1) uscita1 = t.ora
    } else {
      // Pomeriggio
      if (!entrata2) entrata2 = t.ora
      else if (!uscita2) uscita2 = t.ora
    }
  }

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
