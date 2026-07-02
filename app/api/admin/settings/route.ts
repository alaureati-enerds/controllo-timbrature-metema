import { ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
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
  const next = await updateSystemSettings(patch)

  const session = await getSession()
  await audit({
    action: "system.settings.update",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    // Solo i NOMI dei campi toccati: il "cosa" basta, evitiamo di versare in
    // chiaro i valori (qui non ci sono segreti, ma è la regola del log).
    metadata: { fields: Object.keys(patch) },
    request,
  })

  return ok(next)
})
