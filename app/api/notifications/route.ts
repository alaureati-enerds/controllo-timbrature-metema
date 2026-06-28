import { z } from "zod"

import { ok, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { listNotifications } from "@/lib/notifications"

// Elenco delle notifiche dell'utente corrente (canale in-app). Autorizzazione per
// OWNERSHIP: opera sempre sull'utente in sessione, mai su un id passato dal
// client. Vedi docs/notifiche.md.

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  unreadOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
})

// GET /api/notifications — lista paginata { entries, total, unread }
export const GET = safeHandler(async (request) => {
  const session = await getSession()
  if (!session) throw unauthorized()
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const { limit, offset, unreadOnly } = querySchema.parse(params)
  return ok(
    await listNotifications(session.user.id, { limit, offset, unreadOnly })
  )
})
