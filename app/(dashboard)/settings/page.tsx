import type { Metadata } from "next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Impostazioni" }

// Placeholder estensibile: qui andranno le preferenze dell'account (notifiche,
// lingua, ecc.). Per ora richiede solo l'autenticazione.
export default async function SettingsPage() {
  await requireUser()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">
          Preferenze dell&apos;account.
        </p>
      </header>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Preferenze</CardTitle>
          <CardDescription>
            Sezione in costruzione: aggiungi qui le opzioni dell&apos;account.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nessuna preferenza configurabile per ora.
        </CardContent>
      </Card>
    </div>
  )
}
