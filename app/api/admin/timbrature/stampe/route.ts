import { z } from "zod"

import { ok, parseJson, safeHandler } from "@/lib/api"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import {
  deleteStampeStorico,
  listStampeStorico,
} from "@/lib/timbrature/stampe-storico"

// Endpoint dello storico stampe: lettura paginata e cancellazione MASSIVA. La
// scrittura (creazione) non passa da qui: avviene come side-effect di GET
// /api/admin/timbrature/stampa (vedi lib/timbrature/stampe-storico.ts).

const filtersSchema = z.object({
  q: z.string().optional(),
  mese: z.coerce.number().int().min(1).max(12).optional(),
  anno: z.coerce.number().int().min(2000).max(2100).optional(),
  cumulativo: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

// GET /api/admin/timbrature/stampe — storico paginato e filtrato
export const GET = safeHandler(async (request) => {
  await requireTimbraturePermission("read")
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const filters = filtersSchema.parse(params)
  return ok(await listStampeStorico(filters))
})

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

// DELETE /api/admin/timbrature/stampe — elimina PIÙ stampe dallo storico
// (riga + PDF) in un colpo solo. Azione esplicita dell'admin (confermata in
// UI con un AlertDialog). Richiede `timbrature.update`.
export const DELETE = safeHandler(async (request) => {
  await requireTimbraturePermission("update")
  const { ids } = await parseJson(request, bulkDeleteSchema)
  const deleted = await deleteStampeStorico(ids)
  return ok({ deleted })
})
