import type { Metadata } from "next"

import { AdminOverview } from "@/components/admin/dashboard/admin-overview"
import { PersonalOverview } from "@/components/dashboard/personal-overview"
import { isAdmin, requireUser } from "@/lib/auth-helpers"

export const metadata: Metadata = {
  title: "Home",
}

// Pagina Home (rotta "/"). Gli admin vedono le scorciatoie alle due zone di
// lavoro principali (Timbrature, Orari di lavoro); gli altri utenti vedono la
// propria vista personale (risorse + sicurezza dell'account).
export default async function DashboardPage() {
  const session = await requireUser()
  const admin = await isAdmin()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">
          {admin
            ? "Le tue scorciatoie a Timbrature e Orari di lavoro."
            : "La tua panoramica: file, notifiche e sicurezza dell'account."}
        </p>
      </header>

      {admin ? (
        <AdminOverview />
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
