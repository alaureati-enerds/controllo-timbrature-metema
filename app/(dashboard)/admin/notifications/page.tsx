import type { Metadata } from "next"

import { NotificationSettingsForm } from "@/components/admin/notification-settings-form"
import { requireRole } from "@/lib/auth-helpers"
import { getNotificationSettings } from "@/lib/settings/notifications"

export const metadata: Metadata = { title: "Notifiche" }

// Pagina riservata agli admin: configurazione del sistema di notifiche (quali
// azioni notificano, retention). La protezione server (requireRole) reindirizza
// chi non è admin; l'endpoint sottostante ricontrolla il permesso `settings`.
// Card a larghezza piena (vedi linee guida UI in CLAUDE.md). Vedi docs/notifiche.md.
export default async function AdminNotificationsPage() {
  await requireRole("admin")
  const settings = await getNotificationSettings()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Notifiche
        </h1>
        <p className="text-sm text-muted-foreground">
          Configura quali azioni generano una notifica e per quanto conservare
          quelle lette. Ogni utente sceglie poi come riceverle dal proprio
          profilo.
        </p>
      </header>

      <NotificationSettingsForm initial={settings} />
    </div>
  )
}
