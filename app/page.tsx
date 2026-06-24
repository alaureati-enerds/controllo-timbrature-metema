import { NotebookPenIcon } from "lucide-react"

import { NoteForm } from "@/components/note-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { listNotes } from "@/lib/notes"

// Server Component: legge le note direttamente dal layer di dominio (Prisma -> Postgres).
export default async function Page() {
  const notes = await listNotes()

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">shadcn starter</h1>
        <p className="text-sm text-muted-foreground">
          Scaffold Next.js + shadcn/ui + Prisma + PostgreSQL. Le note sotto sono un
          esempio end-to-end: dalla UI al database e ritorno.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Note</CardTitle>
          <CardDescription>Aggiungi una nota per provare il flusso completo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <NoteForm />
          <Separator />
          {notes.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <NotebookPenIcon />
                </EmptyMedia>
                <EmptyTitle>Nessuna nota</EmptyTitle>
                <EmptyDescription>
                  Non c&apos;è ancora nulla qui. Scrivi la tua prima nota.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="flex flex-col gap-1 rounded-md border p-3"
                >
                  <span className="text-sm">{note.text}</span>
                  <span className="text-xs text-muted-foreground">
                    {note.createdAt.toLocaleString("it-IT")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
