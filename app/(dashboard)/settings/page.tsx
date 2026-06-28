import type { Metadata } from "next"

import { NotificationPreferencesForm } from "@/components/profile/notification-preferences-form"
import { requireUser } from "@/lib/auth-helpers"
import { getUserPreferences } from "@/lib/settings/user"

export const metadata: Metadata = { title: "Impostazioni" }

// Preferenze PER-UTENTE su come l'app si comporta (notifiche e, in futuro, tema
// e lingua). I dati personali e la sicurezza dell'account stanno nel profilo.
export default async function SettingsPage() {
  const session = await requireUser()
  const preferences = await getUserPreferences(session.user.id)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">
          Come l&apos;app si comporta per te.
        </p>
      </header>

      <NotificationPreferencesForm initial={preferences} />
    </div>
  )
}
