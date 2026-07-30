import type { Metadata } from "next"

import { TimbratureStampeStorico } from "@/components/admin/timbrature-stampe-storico"
import { requireRole } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Storico stampe" }

export default async function AdminTimbratureStampeStoricoPage() {
  await requireRole("admin")

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Storico stampe
        </h1>
        <p className="text-sm text-muted-foreground">
          Registri presenze già generati: ogni PDF è uno snapshot del momento
          in cui è stato prodotto, riscaricabile anche se il periodo viene
          corretto in seguito. La retention si configura in Impostazioni di
          sistema.
        </p>
      </header>

      <TimbratureStampeStorico />
    </div>
  )
}
