import type { Metadata } from "next"

import { NotificationsView } from "@/components/notifications-view"
import { requireUser } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Notifiche" }

// Pagina completa delle notifiche dell'utente. NON è una voce di sidebar: ci si
// arriva solo dalla campanella in topbar ("Vedi tutte le notifiche"). Protetta da
// requireUser; i dati arrivano dalle API per-utente (ownership). Vedi
// docs/notifiche.md.
export default async function NotificationsPage() {
  await requireUser()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Notifiche
        </h1>
        <p className="text-sm text-muted-foreground">
          Tutti gli avvisi del tuo account. Scegli quali ricevere dal tuo
          profilo.
        </p>
      </header>

      <NotificationsView />
    </div>
  )
}
