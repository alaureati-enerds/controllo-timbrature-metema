import type { Metadata } from "next"

import { TimbratureManager } from "@/components/admin/timbrature-manager"
import { requireRole } from "@/lib/auth-helpers"
import { getUserPreferences } from "@/lib/settings/user"

export const metadata: Metadata = { title: "Timbrature" }

export default async function AdminTimbraturePage() {
  const session = await requireRole("admin")

  // Template di stampa predefinito: preferenza PER-UTENTE (impostabile in
  // /settings). La leggiamo qui (server) così il dialog parte già dal valore
  // giusto senza un fetch all'apertura.
  const {
    stampa: { templateId },
  } = await getUserPreferences(session.user.id)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Timbrature
        </h1>
        <p className="text-sm text-muted-foreground">
          Consulta le timbrature dei dipendenti dal database MySQL esterno.
        </p>
      </header>
      <TimbratureManager templatePredefinito={templateId} />
    </div>
  )
}
