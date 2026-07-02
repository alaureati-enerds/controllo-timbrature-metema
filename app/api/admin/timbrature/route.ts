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
  const sogliaPomeriggio = minutiFromOra(orario.secondoIngresso) - 30

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

    const e: string[] = []
    const u: string[] = []
    for (const t of ordinate) {
      if (t.tipologia === "E") e.push(t.ora)
      else u.push(t.ora)
    }

    // Assegna turni: prima la prima E->U, poi la seconda
    let entrata1: string | null = null
    let uscita1: string | null = null
    let entrata2: string | null = null
    let uscita2: string | null = null
    let totaleMinuti = 0

    let ei = 0
    let ui = 0

    // Primo turno: trova prima E e prima U dopo quella E
    if (ei < e.length && ui < u.length) {
      entrata1 = e[ei]
      ei++
      // Trova la prima U dopo entrata1
      while (ui < u.length && minutiFromOra(u[ui]) < minutiFromOra(entrata1)) {
        ui++
      }
      if (ui < u.length) {
        uscita1 = u[ui]
        ui++
        totaleMinuti += minutiFromOra(uscita1) - minutiFromOra(entrata1)
      }

      // Secondo turno: trova E dopo uscita1 (o dopo soglia pomeriggio)
      if (ei < e.length) {
        const soglia1 = uscita1
          ? minutiFromOra(uscita1)
          : sogliaPomeriggio
        while (ei < e.length && minutiFromOra(e[ei]) < soglia1) {
          ei++
        }
        if (ei < e.length) {
          entrata2 = e[ei]
          ei++
          while (
            ui < u.length &&
            minutiFromOra(u[ui]) < minutiFromOra(entrata2)
          ) {
            ui++
          }
          if (ui < u.length) {
            uscita2 = u[ui]
            ui++
            totaleMinuti += minutiFromOra(uscita2) - minutiFromOra(entrata2)
          }
        }
      }
    }

    // Se abbiamo solo U senza E (timbratura iniziale come uscita? raro ma gestiamo)
    if (!entrata1 && ui < u.length) {
      uscita1 = u[ui]
      ui++
    }
    if (!entrata2 && ui < u.length) {
      uscita2 = u[ui]
      ui++
    }

    // Se abbiamo entrate senza uscite abbinate, mettiamo comunque le entrate
    if (entrata1 && !uscita1 && ei > 0) {
      // Potrebbe rimanere solo l'entrata (es. timbratura singola)
    }

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
