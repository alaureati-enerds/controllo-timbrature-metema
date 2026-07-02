import { z } from "zod"

import { ok, parseJson, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { markAllRead, markRead } from "@/lib/notifications"

// Segna come lette le notifiche dell'utente corrente. Con `id` marca la singola
// notifica; senza `id` le marca tutte. Autorizzazione per OWNERSHIP: le funzioni
// di servizio filtrano sempre per l'utente in sessione, così un id altrui è un
// no-op. Vedi docs/notifiche.md.

const bodySchema = z.object({ id: z.string().min(1).optional() })

// POST /api/notifications/read — { id? } → { updated }
export const POST = safeHandler(async (request) => {
  const session = await getSession()
  if (!session) throw unauthorized()
  const { id } = await parseJson(request, bodySchema)
  const updated = id
    ? await markRead(session.user.id, id)
    : await markAllRead(session.user.id)
  return ok({ updated })
})
