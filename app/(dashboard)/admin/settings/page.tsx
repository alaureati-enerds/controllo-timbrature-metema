import type { Metadata } from "next"

import { SystemSettingsForm } from "@/components/admin/system-settings-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireRole } from "@/lib/auth-helpers"
import { getSystemSettings } from "@/lib/settings/system"

export const metadata: Metadata = { title: "Impostazioni di sistema" }

// Pagina riservata agli admin: configurazione GLOBALE dell'applicazione (nome,
// sottotitolo, icona). La protezione server (requireRole) reindirizza chi non è
// admin; l'endpoint sottostante ricontrolla comunque il permesso `settings`.
export default async function AdminSettingsPage() {
  await requireRole("admin")
  const settings = await getSystemSettings()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Impostazioni di sistema
        </h1>
        <p className="text-sm text-muted-foreground">
          Configurazione globale dell&apos;applicazione, valida per tutti gli
          utenti.
        </p>
      </header>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Identità</CardTitle>
          <CardDescription>
            Nome, sottotitolo e icona mostrati nell&apos;interfaccia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SystemSettingsForm initial={settings} />
        </CardContent>
      </Card>
    </div>
  )
}
