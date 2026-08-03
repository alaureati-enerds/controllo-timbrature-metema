import type { Metadata } from "next"

import { GiustificativiManager } from "@/components/admin/giustificativi-manager"
import { requireRole } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Giustificativi" }

export default async function AdminGiustificativiPage() {
  await requireRole("admin")

  // Nessun I/O qui: a differenza degli Orari di lavoro non c'è una voce
  // "standard" dalle impostazioni di sistema da anteporre, il catalogo è tutto
  // nella tabella e lo carica il manager.
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Giustificativi
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestisci i motivi di assenza (ferie, malattia, permessi) da applicare
          alle giornate senza timbrature.
        </p>
      </header>
      <GiustificativiManager />
    </div>
  )
}
