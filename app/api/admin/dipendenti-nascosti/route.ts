import { z } from "zod"

import { ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import {
  listDipendentiNascosti,
  setDipendenteNascosto,
} from "@/lib/dipendenti/nascosti"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"

const putSchema = z.object({
  dipendente: z.string().min(1),
  nascosto: z.boolean(),
})

// GET /api/admin/dipendenti-nascosti
// Codici dei dipendenti nascosti dalla select della pagina Timbrature.
export const GET = safeHandler(async () => {
  await requireTimbraturePermission("read")
  return ok(await listDipendentiNascosti())
})

// PUT /api/admin/dipendenti-nascosti
// Nasconde/rimostra un dipendente nella select della pagina Timbrature.
export const PUT = safeHandler(async (request) => {
  await requireTimbraturePermission("update")
  const { dipendente, nascosto } = await parseJson(request, putSchema)
  await setDipendenteNascosto(dipendente, nascosto)

  const session = await getSession()
  await audit({
    action: "timbrature.dipendente_nascosto.update",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    target: { type: "dipendente", id: dipendente },
    metadata: { nascosto },
    request,
  })

  return ok({ saved: true })
})
