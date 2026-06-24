import Link from "next/link"
import { ArrowRightIcon, NotebookPenIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { listNotes } from "@/lib/notes"

// Pagina di overview della dashboard (rotta "/").
export default async function DashboardPage() {
  const notes = await listNotes()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Panoramica dello scaffold. Da qui raggiungi le sezioni dell&apos;app.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Note</CardTitle>
            <CardDescription>Note salvate nel database</CardDescription>
            <CardAction>
              <NotebookPenIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{notes.length}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" asChild>
              <Link href="/notes">
                Vai alle note
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
