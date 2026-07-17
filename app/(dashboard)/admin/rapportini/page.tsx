import type { Metadata } from "next"

import { RapportiniManager } from "@/components/admin/rapportini-manager"
import { requireRole } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Rapportini" }

export default async function AdminRapportiniPage() {
  await requireRole("admin")

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Rapportini
        </h1>
        <p className="text-sm text-muted-foreground">
          Confronta il marcatempo con i rapportini di assistenza tecnica:
          anteprima di sola lettura, in attesa di essere incrociata nella
          pagina Timbrature.
        </p>
      </header>
      <RapportiniManager />
    </div>
  )
}
