import type { Metadata } from "next"

import { FileManager } from "@/components/file-manager"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth-helpers"
import { listUserFiles } from "@/lib/files"

export const metadata: Metadata = { title: "I miei file" }

// Pagina "I miei file": esempio end-to-end del sottosistema file sull'asse
// OWNERSHIP (ogni utente vede e gestisce solo i propri file). Stesso modello di
// autorizzazione delle note. Vedi docs/gestione-file.md.
export default async function FilesPage() {
  const session = await requireUser()
  const files = await listUserFiles(session.user.id)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">I miei file</h1>
        <p className="text-sm text-muted-foreground">
          Carica file privati: sono accessibili solo al tuo account.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>File</CardTitle>
          <CardDescription>
            Upload, download ed eliminazione dei tuoi file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileManager initialFiles={files} />
        </CardContent>
      </Card>
    </div>
  )
}
