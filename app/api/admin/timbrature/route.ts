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
 * usando un algoritmo a finestre temporali basate sugli orari di lavoro configurati.
 *
 * ## Algoritmo
 * Le timbrature possono essere incomplete o con tipologia errata (es. una
 * seconda entrata battuta come uscita). Invece di accoppiare E/U per tipo,
 * ogni turno cerca nella propria finestra oraria la timbratura più adatta:
 *
 * - **Turno 1** (finestra: `[primoIngresso - 1h, primaUscita + 30min]`):
 *   - `entrata1` = timbratura **E** più vicina a `primoIngresso`.
 *     Se non c'è nessuna E, usa la prima timbratura della finestra.
 *   - `uscita1` = timbratura **U** più vicina a `primaUscita`,
 *     dopo `entrata1`. Se non c'è nessuna U, usa l'ultima timbratura
 *     della finestra dopo `entrata1`.
 *
 * - **Gap pomeriggio** = `uscita1 + 10min` (pausa pranzo minima).
 *   Se non c'è uscita1, parte da `primaUscita + 10min`.
 *
 * - **Turno 2** (finestra: `[gap pomeriggio, secondaUscita + 30min]`):
 *   - `entrata2` = prima timbratura **di qualunque tipo** nella finestra
 *     (accetta U come E se manca la battuta di entrata).
 *   - `uscita2` = ultima timbratura nella finestra dopo `entrata2`.
 *     Se c'è una U, usa quella; altrimenti usa l'ultima disponibile.
 *
 * ## Casi gestiti
 * | Seq | Comportamento |
 * |-----|--------------|
 * | E,U,U,U (07:28, 12:30, 13:57, 17:01) | entrata1=07:28, uscita1=12:30, entrata2=13:57(U→accettata), uscita2=17:01 |
 * | E,U,U (07:28, 12:30, 13:57) | entrata1=07:28, uscita1=12:30, entrata2=13:57 (senza uscita2) |
 * | E,U (07:28, 17:01) | entrata1=07:28, uscita1=17:01 (turno unico) |
 * | E,E,U,U (07:28, 08:15, 12:30, 17:01) | entrata1=07:28, uscita1=12:30 (seconda E ignorata, dopo uscita1 non c'è finestra valida) |
 * | E,U,E,U,U (07:28, 12:30, 14:00, 16:00, 17:30) | entrata1=07:28, uscita1=12:30, entrata2=14:00, uscita2=17:30 (U=16:00 ignorata) |
 * | U,U (12:30, 17:01) | entrata1=12:30 (U→accettata), uscita1=17:01 (turno unico) |
 */
function assegnaTurni(
  timbrature: { ora: string; tipologia: string }[],
  orario: { primoIngresso: string; primaUscita: string; secondoIngresso: string; secondaUscita: string }
) {
  let entrata1: string | null = null
  let uscita1: string | null = null
  let entrata2: string | null = null
  let uscita2: string | null = null

  if (timbrature.length === 0) {
    return { entrata1, uscita1, entrata2, uscita2, totaleMinuti: 0 }
  }

  const pIngresso = minutiFromOra(orario.primoIngresso)
  const pUscita = minutiFromOra(orario.primaUscita)
  const sUscita = minutiFromOra(orario.secondaUscita)

  // --- Turno 1: finestra [primoIngresso - 1h, primaUscita + 30min] ---
  const t1Min = pIngresso - 60
  const t1Max = pUscita + 30

  const inT1 = timbrature.filter((t) => {
    const m = minutiFromOra(t.ora)
    return m >= t1Min && m <= t1Max
  })

  if (inT1.length > 0) {
    // entrata1: E più vicina a primoIngresso
    const e1Candidati = inT1.filter((t) => t.tipologia === "E")
    entrata1 = e1Candidati.length > 0
      ? e1Candidati.reduce((a, b) =>
          Math.abs(minutiFromOra(a.ora) - pIngresso) <
          Math.abs(minutiFromOra(b.ora) - pIngresso) ? a : b
        ).ora
      : inT1[0].ora

    // uscita1: U più vicina a primaUscita, dopo entrata1
    const dopoE1 = inT1.filter(
      (t) => minutiFromOra(t.ora) > minutiFromOra(entrata1!)
    )
    const u1Candidati = dopoE1.filter((t) => t.tipologia === "U")
    uscita1 = u1Candidati.length > 0
      ? u1Candidati.reduce((a, b) =>
          Math.abs(minutiFromOra(a.ora) - pUscita) <
          Math.abs(minutiFromOra(b.ora) - pUscita) ? a : b
        ).ora
      : dopoE1.length > 0
        ? dopoE1[dopoE1.length - 1].ora
        : null
  }

  // --- Gap pomeriggio ---
  const gap = uscita1
    ? minutiFromOra(uscita1) + 10
    : pUscita + 10

  // --- Turno 2: finestra [gap, secondaUscita + 30min] ---
  const t2Min = gap
  const t2Max = sUscita + 30

  const inT2 = timbrature.filter((t) => {
    const m = minutiFromOra(t.ora)
    return m >= t2Min && m <= t2Max
  })

  if (inT2.length > 0) {
    // entrata2: prima timbratura di qualunque tipo nella finestra
    entrata2 = inT2[0].ora

    // uscita2: ultima timbratura U nella finestra dopo entrata2
    const dopoE2 = inT2.filter(
      (t) => minutiFromOra(t.ora) > minutiFromOra(entrata2!)
    )
    if (dopoE2.length > 0) {
      const u2Candidati = dopoE2.filter((t) => t.tipologia === "U")
      uscita2 = u2Candidati.length > 0
        ? u2Candidati[u2Candidati.length - 1].ora
        : dopoE2[dopoE2.length - 1].ora
    }
  }

  // --- Calcolo totale minuti ---
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
