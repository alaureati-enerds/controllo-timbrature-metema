import { z } from "zod"

import { ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import {
  listDipendentiRichiesti,
  setRapportinoRichiesto,
} from "@/lib/rapportini/richiesti"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"

const putSchema = z.object({
  dipendente: z.string().min(1),
  richiesto: z.boolean(),
})

// GET /api/admin/dipendenti-rapportino
// Codici dei dipendenti per cui il rapportino è obbligatorio.
export const GET = safeHandler(async () => {
  await requireTimbraturePermission("read")
  return ok(await listDipendentiRichiesti())
})

// PUT /api/admin/dipendenti-rapportino
// Attiva/disattiva l'obbligo di rapportino per un dipendente.
export const PUT = safeHandler(async (request) => {
  await requireTimbraturePermission("update")
  const { dipendente, richiesto } = await parseJson(request, putSchema)
  await setRapportinoRichiesto(dipendente, richiesto)

  const session = await getSession()
  await audit({
    action: "timbrature.rapportino_richiesto.update",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    target: { type: "dipendente", id: dipendente },
    metadata: { richiesto },
    request,
  })

  return ok({ saved: true })
})
