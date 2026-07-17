import { endOfMonth, format, startOfMonth } from "date-fns"
import { z } from "zod"

import { ApiError, ok, safeHandler } from "@/lib/api"
import { getRapportini } from "@/lib/mysql/rapportini"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"

// Righe grezze dei rapportini di un dipendente per un mese: raggruppamento
// per giorno e calcolo (somma, split ordinario/straordinario, orario
// ricostruito) restano client-side, in lib/rapportini/calcolo.ts — stesso
// pattern di app/api/admin/timbrature/route.ts.

const paramsSchema = z.object({
  dipendente: z.string().min(1),
  mese: z.coerce.number().int().min(1).max(12),
  anno: z.coerce.number().int().min(2000).max(2100),
})

export const GET = safeHandler(async (request) => {
  await requireTimbraturePermission("read")

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const { dipendente, mese, anno } = paramsSchema.parse(params)

  const primo = new Date(anno, mese - 1, 1)
  const dal = format(startOfMonth(primo), "yyyy-MM-dd")
  const al = format(endOfMonth(primo), "yyyy-MM-dd")

  try {
    const rapportini = await getRapportini(dipendente, dal, al)
    return ok({ rapportini })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "errore sconosciuto"
    throw new ApiError(`Impossibile leggere i rapportini: ${detail}`, 502)
  }
})
