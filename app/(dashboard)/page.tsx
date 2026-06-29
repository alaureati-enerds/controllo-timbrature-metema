import type { Metadata } from "next"

import { AdminOverview } from "@/components/admin/dashboard/admin-overview"
import { PersonalOverview } from "@/components/dashboard/personal-overview"
import { isAdmin, requireUser } from "@/lib/auth-helpers"
import { getAdminStats } from "@/lib/dashboard/admin-stats"

export const metadata: Metadata = {
  title: "Dashboard",
}

// Pagina di overview della dashboard (rotta "/"). Gli admin vedono una
// panoramica di sistema (KPI, andamento, ultime attività); gli altri utenti
// vedono la propria vista personale (risorse + sicurezza dell'account).
export default async function DashboardPage() {
  const session = await requireUser()
  const admin = await isAdmin()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {admin
            ? "Panoramica di sistema: utenti, operazioni e attività recenti."
            : "La tua panoramica: note, file, notifiche e sicurezza dell'account."}
        </p>
      </header>

      {admin ? (
        <AdminOverview stats={await getAdminStats()} />
      ) : (
        <PersonalOverview
          userId={session.user.id}
          user={{
            emailVerified: Boolean(session.user.emailVerified),
            twoFactorEnabled: Boolean(
              (session.user as { twoFactorEnabled?: boolean | null })
                .twoFactorEnabled
            ),
          }}
        />
      )}
    </div>
  )
}
