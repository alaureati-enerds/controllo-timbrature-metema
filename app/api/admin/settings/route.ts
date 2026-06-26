import { ok, parseJson, safeHandler } from "@/lib/api"
import { systemSettingsPatchSchema } from "@/lib/settings/schema"
import { requireSettingsPermission } from "@/lib/settings/authz"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"

// Endpoint di amministrazione per le impostazioni di SISTEMA (globali). La
// protezione è per ruolo/permesso (RBAC), non per ownership: solo chi ha il
// permesso `settings.*` (cioè il ruolo admin) può leggere/scrivere. Vedi
// lib/permissions.ts e docs/impostazioni-di-sistema.md.

// GET /api/admin/settings — impostazioni correnti (solo admin)
export const GET = safeHandler(async () => {
  await requireSettingsPermission("read")
  return ok(await getSystemSettings())
})

// PUT /api/admin/settings — aggiorna le impostazioni (patch parziale, solo admin)
export const PUT = safeHandler(async (request) => {
  await requireSettingsPermission("update")
  const patch = await parseJson(request, systemSettingsPatchSchema)
  return ok(await updateSystemSettings(patch))
})
