import { notFound, ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import {
  contaGiornateGiustificate,
  deleteGiustificativo,
  getGiustificativo,
  updateGiustificativo,
} from "@/lib/timbrature/giustificativo"
import { requireGiustificativoPermission } from "@/lib/timbrature/giustificativo-authz"
import { giustificativoSchema } from "@/lib/timbrature/giustificativo-schema"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/giustificativi/[id] — dettaglio + quante giornate lo usano
// (serve al dialog di eliminazione per dire quanto pesa il gesto).
export const GET = safeHandler(async (_request, context) => {
  await requireGiustificativoPermission("read")
  const { id } = await (context as Ctx).params

  const giustificativo = await getGiustificativo(id)
  if (!giustificativo) throw notFound("Giustificativo non trovato")

  return ok({
    ...giustificativo,
    giornate: await contaGiornateGiustificate(giustificativo.codice),
  })
})

// PUT /api/admin/giustificativi/[id] — aggiorna un giustificativo. Se cambia la
// sigla, updateGiustificativo riscrive anche le giornate che la usavano.
export const PUT = safeHandler(async (request, context) => {
  await requireGiustificativoPermission("update")
  const { id } = await (context as Ctx).params
  const data = await parseJson(request, giustificativoSchema)

  const precedente = await getGiustificativo(id)
  if (!precedente) throw notFound("Giustificativo non trovato")
  const giustificativo = await updateGiustificativo(id, data, precedente.codice)

  const session = await getSession()
  await audit({
    action: "timbrature.giustificativo.update",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    target: {
      type: "giustificativo",
      id: giustificativo.id,
      label: giustificativo.codice,
    },
    request,
  })

  return ok(giustificativo)
})

// DELETE /api/admin/giustificativi/[id] — elimina un giustificativo. Le
// giornate già giustificate restano come sono (vedi deleteGiustificativo).
export const DELETE = safeHandler(async (request, context) => {
  await requireGiustificativoPermission("delete")
  const { id } = await (context as Ctx).params

  const giustificativo = await getGiustificativo(id)
  if (!giustificativo) throw notFound("Giustificativo non trovato")
  await deleteGiustificativo(id)

  const session = await getSession()
  await audit({
    action: "timbrature.giustificativo.delete",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    target: {
      type: "giustificativo",
      id: giustificativo.id,
      label: giustificativo.codice,
    },
    request,
  })

  return ok({ deleted: true })
})
