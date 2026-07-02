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
 * grezze accoppiando E con U in ordine e distribuendo le coppie nelle
 * finestre orarie.
 *
 * ## Algoritmo
 * 1. Separo le timbrature per tipo: `es` e `us`.
 * 2. Accoppio in ordine: 1ª E → 1ª U dopo di essa, 2ª E → 2ª U dopo.
 *    Ogni coppia finisce in una finestra in base all'orario della E:
 *    finestra mattina (prima di `separazione`) → turno1,
 *    finestra pomeriggio (dopo `separazione`) → turno2.
 * 3. Il tipo non viene mai alterato: una U non diventa mai una E e
 *    viceversa. Timbrature senza accoppiamento vengono ignorate.
 *
 * ## Esempio
 * Finestre: 08:00–12:00 e 14:00–18:00. Separazione = 13:00.
 * Timbrature: E 07:58, U 12:02, E 13:50, U 18:01
 * - E 07:58 → U 12:02 → coppia 1, 07:58 < 13:00 → turno1 ✓
 * - E 13:50 → U 18:01 → coppia 2, 13:50 ≥ 13:00 → turno2 ✓
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

  // Separa per tipo
  const es = timbrature.filter((t) => t.tipologia === "E")
  const us = timbrature.filter((t) => t.tipologia === "U")

  // Accoppia in ordine: 1ª E → 1ª U dopo di essa, 2ª E → 2ª U dopo
  let ui = 0
  for (const e of es) {
    if (ui >= us.length) break

    // Trova la prima U dopo questa E
    while (ui < us.length && minutiFromOra(us[ui].ora) <= minutiFromOra(e.ora)) {
      ui++
    }
    if (ui >= us.length) break

    const coppia: { entrata: string; uscita: string } = {
      entrata: e.ora,
      uscita: us[ui].ora,
    }
    ui++

    // Assegna alla finestra giusta in base all'orario della E
    if (minutiFromOra(e.ora) < separazione) {
      if (!entrata1) {
        entrata1 = coppia.entrata
        uscita1 = coppia.uscita
      }
    } else {
      if (!entrata2) {
        entrata2 = coppia.entrata
        uscita2 = coppia.uscita
      }
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
