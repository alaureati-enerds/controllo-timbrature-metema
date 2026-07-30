import { ok, parseJson, safeHandler } from "@/lib/api"
import { stampeSettingsSchema } from "@/lib/settings/schema"
import {
  getStampeStoricoSettings,
  updateStampeStoricoSettings,
} from "@/lib/settings/stampe-storico"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"

// Endpoint di configurazione dello storico stampe (retention). Separato dalla
// lista perché è una modifica, non una lettura: richiede `timbrature.update`.
// Vedi lib/settings/stampe-storico.ts.

// GET /api/admin/timbrature/stampe/settings — config corrente
export const GET = safeHandler(async () => {
  await requireTimbraturePermission("update")
  return ok(await getStampeStoricoSettings())
})

// PUT /api/admin/timbrature/stampe/settings — salva la config
export const PUT = safeHandler(async (request) => {
  await requireTimbraturePermission("update")
  const next = await parseJson(request, stampeSettingsSchema)
  return ok(await updateStampeStoricoSettings(next))
})
