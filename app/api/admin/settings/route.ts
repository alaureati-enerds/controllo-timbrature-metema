import { headers } from "next/headers"

import { ok, parseJson, safeHandler, unauthorized, forbidden } from "@/lib/api"
import { auth } from "@/lib/auth"
import { getSession } from "@/lib/auth-helpers"
import { systemSettingsPatchSchema } from "@/lib/settings/schema"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"

// Endpoint di amministrazione per le impostazioni di SISTEMA (globali). La
// protezione è per ruolo/permesso (RBAC), non per ownership: solo chi ha il
// permesso `settings.*` (cioè il ruolo admin) può leggere/scrivere. Vedi
// lib/permissions.ts e docs/impostazioni-di-sistema.md.

// Verifica che l'utente autenticato abbia il permesso richiesto sulla risorsa
// `settings`, sfruttando l'access control di Better Auth (lib/permissions.ts).
async function requireSettingsPermission(action: "read" | "update") {
  const session = await getSession()
  if (!session) throw unauthorized()

  const { success } = await auth.api.userHasPermission({
    headers: await headers(),
    body: { permissions: { settings: [action] } },
  })
  if (!success) throw forbidden()
}

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
