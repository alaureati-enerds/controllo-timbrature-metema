import type { Metadata } from "next"

import { OrariLavoroManager } from "@/components/admin/orari-lavoro-manager"
import { requireRole } from "@/lib/auth-helpers"
import { getOrarioSettingsForAdmin } from "@/lib/settings/orario"

export const metadata: Metadata = { title: "Orari di lavoro" }

export default async function AdminOrariLavoroPage() {
  await requireRole("admin")

  // L'Orario Standard resta la fonte di verità nelle impostazioni di sistema
  // (guida anche il calcolo dei turni): lo passiamo al manager come voce di
  // sola lettura, mappando i nomi campo su entrata/uscita.
  const orario = await getOrarioSettingsForAdmin()
  const standard = {
    entrata1: orario.primoIngresso,
    uscita1: orario.primaUscita,
    entrata2: orario.secondoIngresso,
    uscita2: orario.secondaUscita,
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Orari di lavoro
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestisci i preset di orario da applicare in blocco alle correzioni
          delle timbrature.
        </p>
      </header>
      <OrariLavoroManager standard={standard} />
    </div>
  )
}
