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
import type { Metadata } from "next"

import { AdminOverview } from "@/components/admin/dashboard/admin-overview"
import { isAdmin, requireUser } from "@/lib/auth-helpers"
import { getAdminStats } from "@/lib/dashboard/admin-stats"
import { listNotes } from "@/lib/notes"

export const metadata: Metadata = {
  title: "Dashboard",
}

// Pagina di overview della dashboard (rotta "/"). Gli admin vedono una
// panoramica di sistema (KPI, andamento, ultime attività); gli altri utenti
// vedono la propria vista personale.
export default async function DashboardPage() {
  const session = await requireUser()
  const admin = await isAdmin()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {admin
            ? "Panoramica di sistema: utenti, operazioni e attività recenti."
            : "Panoramica dello scaffold. Da qui raggiungi le sezioni dell'app."}
        </p>
      </header>

      {admin ? (
        <AdminOverview stats={await getAdminStats()} />
      ) : (
        <PersonalOverview userId={session.user.id} />
      )}
    </div>
  )
}

// Vista per l'utente non-admin: le proprie risorse.
async function PersonalOverview({ userId }: { userId: string }) {
  const notes = await listNotes(userId)

  return (
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
  )
}
