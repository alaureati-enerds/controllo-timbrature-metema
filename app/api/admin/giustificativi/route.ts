import { ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import {
  createGiustificativo,
  listGiustificativi,
} from "@/lib/timbrature/giustificativo"
import { requireGiustificativoPermission } from "@/lib/timbrature/giustificativo-authz"
import { giustificativoSchema } from "@/lib/timbrature/giustificativo-schema"

// GET /api/admin/giustificativi — anagrafica dei giustificativi di assenza.
export const GET = safeHandler(async () => {
  await requireGiustificativoPermission("read")
  return ok(await listGiustificativi())
})

// POST /api/admin/giustificativi — crea un giustificativo.
export const POST = safeHandler(async (request) => {
  await requireGiustificativoPermission("create")
  const data = await parseJson(request, giustificativoSchema)
  const giustificativo = await createGiustificativo(data)

  const session = await getSession()
  await audit({
    action: "timbrature.giustificativo.create",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    target: {
      type: "giustificativo",
      id: giustificativo.id,
      label: giustificativo.codice,
    },
    request,
  })

  return ok(giustificativo, { status: 201 })
})
