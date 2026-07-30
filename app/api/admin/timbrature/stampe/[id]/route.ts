import { fail, ok, safeHandler } from "@/lib/api"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import { deleteStampaStorico } from "@/lib/timbrature/stampe-storico"

type Context = { params: Promise<{ id: string }> }

// DELETE /api/admin/timbrature/stampe/:id — elimina UNA stampa dallo storico
// (riga + PDF). Azione esplicita dell'admin (confermata in UI con un
// AlertDialog), distinta dal pruning automatico di retention. Richiede
// `timbrature.update`, come la configurazione della retention.
export const DELETE = safeHandler(async (_request, context) => {
  await requireTimbraturePermission("update")

  const { id } = await (context as Context).params
  const deleted = await deleteStampaStorico(id)
  if (!deleted) return fail("Stampa non trovata", 404)

  return ok({ id })
})
