import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth-helpers"
import { getNote } from "@/lib/notes"

export const metadata: Metadata = {
  title: "Dettaglio nota",
}

// Pagina di dettaglio di una singola nota (sola lettura). È la destinazione dei
// risultati "Note" della ricerca globale (href: /notes/{id}). Il pattern —
// rotta parametrica + getNote con ownership + notFound() — è quello da replicare
// per il dettaglio di nuovi tipi di record.
export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireUser()
  const { id } = await params
  const note = await getNote(session.user.id, id)
  if (!note) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/notes">
            <ArrowLeftIcon data-icon="inline-start" />
            Torna alle note
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nota</CardTitle>
          <CardDescription>
            Creata il {note.createdAt.toLocaleString("it-IT")}
            {note.updatedAt.getTime() !== note.createdAt.getTime() &&
              ` · aggiornata il ${note.updatedAt.toLocaleString("it-IT")}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{note.text}</p>
        </CardContent>
      </Card>
    </div>
  )
}
