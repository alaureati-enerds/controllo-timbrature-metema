import type { Metadata } from "next"

import { AuditLog } from "@/components/admin/audit-log"
import { AuditSettingsForm } from "@/components/admin/audit-settings-form"
import { requireRole } from "@/lib/auth-helpers"
import { getAuditSettings } from "@/lib/settings/audit"

export const metadata: Metadata = { title: "Audit log" }

// Pagina riservata agli admin: registro delle azioni di sicurezza e relativa
// configurazione. La protezione server (requireRole) reindirizza chi non è
// admin; gli endpoint sottostanti ricontrollano comunque il permesso `audit`.
// Ogni card è a larghezza piena (vedi le linee guida UI in CLAUDE.md).
export default async function AdminAuditPage() {
  await requireRole("admin")
  const settings = await getAuditSettings()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Audit log
        </h1>
        <p className="text-sm text-muted-foreground">
          Registro delle azioni di sicurezza: chi ha fatto cosa, quando e da
          dove. Configura quali eventi tracciare e per quanto conservarli.
        </p>
      </header>

      <AuditSettingsForm initial={settings} />
      <AuditLog />
    </div>
  )
}
