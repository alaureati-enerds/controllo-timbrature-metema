import { z } from "zod"

import { ok, safeHandler } from "@/lib/api"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import { getGiornate } from "@/lib/timbrature/giornate"

// Il tipo `Giornata` e la costruzione delle giornate vivono in
// lib/timbrature/giornate.ts: la stampa PDF ricalcola gli stessi dati senza
// passare da questa route.
export type { Giornata } from "@/lib/timbrature/giornate"

const paramsSchema = z.object({
  dipendente: z.string().min(1),
  mese: z.coerce.number().int().min(1).max(12),
  anno: z.coerce.number().int().min(2000).max(2100),
})

export const GET = safeHandler(async (request) => {
  await requireTimbraturePermission("read")

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const { dipendente, mese, anno } = paramsSchema.parse(params)

  return ok(await getGiornate(dipendente, mese, anno))
})
