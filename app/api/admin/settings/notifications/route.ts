import { forbidden, ok, parseJson, safeHandler, unauthorized } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession, hasPermission } from "@/lib/auth-helpers"
import { notificationSettingsSchema } from "@/lib/settings/schema"
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/lib/settings/notifications"

// Configurazione delle notifiche (lato admin): interruttore generale, tipi
// disabilitati, retention. Protetta dal permesso RBAC `settings` (come il
// branding di sistema): le notifiche sono una impostazione GLOBALE. Vedi
// lib/permissions.ts e docs/notifiche.md.

async function requireSettings(action: "read" | "update"): Promise<void> {
  const session = await getSession()
  if (!session) throw unauthorized()
  if (!(await hasPermission({ settings: [action] }))) throw forbidden()
}

// GET /api/admin/settings/notifications — config corrente (solo admin)
export const GET = safeHandler(async () => {
  await requireSettings("read")
  return ok(await getNotificationSettings())
})

// PUT /api/admin/settings/notifications — salva la config (solo admin)
export const PUT = safeHandler(async (request) => {
  await requireSettings("update")
  const session = await getSession()
  const next = await parseJson(request, notificationSettingsSchema)
  const saved = await updateNotificationSettings(next)
  await audit({
    action: "system.notifications.update",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    request,
  })
  return ok(saved)
})
