import type { Metadata } from "next"

import { JobsManager } from "@/components/admin/jobs-manager"
import { requireRole } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Operazioni in background" }

// Pagina riservata agli admin: la protezione server (requireRole) reindirizza
// chi non è admin. Le azioni passano comunque dalle API protette per RBAC
// (risorsa `jobs`). Vedi docs/operazioni-in-background.md.
export default async function AdminJobsPage() {
  await requireRole("admin")

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Operazioni in background
        </h1>
        <p className="text-sm text-muted-foreground">
          Avvia, monitora e ferma le operazioni eseguite dal worker. Richiede il
          processo worker attivo (npm run worker).
        </p>
      </header>
      <JobsManager />
    </div>
  )
}
