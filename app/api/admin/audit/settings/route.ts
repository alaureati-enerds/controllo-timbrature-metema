import { ok, parseJson, safeHandler } from "@/lib/api"
import { requireAuditPermission } from "@/lib/audit/authz"
import { getAuditSettings, updateAuditSettings } from "@/lib/settings/audit"
import { auditSettingsSchema } from "@/lib/settings/schema"

// Endpoint di configurazione dell'audit log (toggle per evento, retention).
// Separato dal registro perché richiede un permesso diverso: `audit.configure`.
// Vedi lib/permissions.ts e docs/audit-logging.md.

// GET /api/admin/audit/settings — config corrente (solo admin)
export const GET = safeHandler(async () => {
  await requireAuditPermission("configure")
  return ok(await getAuditSettings())
})

// PUT /api/admin/audit/settings — salva la config (solo admin)
export const PUT = safeHandler(async (request) => {
  await requireAuditPermission("configure")
  const next = await parseJson(request, auditSettingsSchema)
  return ok(await updateAuditSettings(next))
})
