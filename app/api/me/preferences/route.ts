import { z } from "zod"

import { ok, parseJson, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { notificationChannels } from "@/lib/notifications/catalog"
import { getUserPreferences, updateUserPreferences } from "@/lib/settings/user"
import { stampaTemplateIds } from "@/lib/timbrature/stampa/catalog"

// Preferenze PER-UTENTE dell'utente corrente (oggi: scelta dei canali di notifica
// per-tipo). Autorizzazione per OWNERSHIP: opera sempre sull'utente in sessione.
// Distinta dalle impostazioni di sistema (/api/admin/settings), che sono globali
// e per RBAC. Vedi docs/impostazioni-di-sistema.md e docs/notifiche.md.

// Patch accettato dal client. Solo i campi modificabili dall'utente; lo schema
// completo (con i default) è in lib/settings/user.ts.
const patchSchema = z.object({
  notifications: z
    .object({
      channels: z.record(z.string(), z.array(z.enum(notificationChannels))),
    })
    .optional(),
  stampa: z.object({ templateId: z.enum(stampaTemplateIds) }).optional(),
})

// GET /api/me/preferences — preferenze correnti (complete, con i default)
export const GET = safeHandler(async () => {
  const session = await getSession()
  if (!session) throw unauthorized()
  return ok(await getUserPreferences(session.user.id))
})

// PUT /api/me/preferences — salva un patch delle preferenze
export const PUT = safeHandler(async (request) => {
  const session = await getSession()
  if (!session) throw unauthorized()
  const patch = await parseJson(request, patchSchema)
  return ok(await updateUserPreferences(session.user.id, patch))
})
