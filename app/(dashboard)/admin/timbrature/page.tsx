import type { Metadata } from "next"

import { TimbratureManager } from "@/components/admin/timbrature-manager"
import { requireRole } from "@/lib/auth-helpers"
import { getStampaSettings } from "@/lib/settings/stampa"

export const metadata: Metadata = { title: "Timbrature" }

export default async function AdminTimbraturePage() {
  await requireRole("admin")

  // Template di stampa predefinito: lo leggiamo qui (server) così il dialog lo
  // ha già pronto e non deve fare un fetch all'apertura.
  const { templateId } = await getStampaSettings()

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
