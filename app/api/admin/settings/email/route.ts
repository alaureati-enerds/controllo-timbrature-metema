import { ok, parseJson, safeHandler } from "@/lib/api"
import {
  getEmailSettingsForAdmin,
  updateEmailSettings,
} from "@/lib/settings/email"
import { requireSettingsPermission } from "@/lib/settings/authz"
import { emailSettingsInputSchema } from "@/lib/settings/schema"

// Endpoint di amministrazione per la config EMAIL di sistema. Separato da
// /api/admin/settings perché gestisce un SEGRETO: la password non viene mai
// restituita (solo `passwordSet`) e in scrittura si aggiorna soltanto se ne
// arriva una nuova. Protetto dal permesso `settings` (solo admin).

// GET /api/admin/settings/email — config corrente, mascherata (solo admin)
export const GET = safeHandler(async () => {
  await requireSettingsPermission("read")
  return ok(await getEmailSettingsForAdmin())
})

// PUT /api/admin/settings/email — salva la config (solo admin)
export const PUT = safeHandler(async (request) => {
  await requireSettingsPermission("update")
  const input = await parseJson(request, emailSettingsInputSchema)
  return ok(await updateEmailSettings(input))
})
