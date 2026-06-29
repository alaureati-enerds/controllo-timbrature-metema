import Link from "next/link"
import { format, parseISO } from "date-fns"
import { it } from "date-fns/locale"
import {
  ArrowRightIcon,
  FolderIcon,
  ListChecksIcon,
  NotebookPenIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminStats } from "@/lib/dashboard/admin-stats"
import type { JobStatus } from "@/lib/generated/prisma/client"

import { ActivityChart } from "./activity-chart"
import { RegistrationsChart } from "./registrations-chart"

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const nf = new Intl.NumberFormat("it-IT")

// Etichette e ordine di visualizzazione degli stati dei job.
const JOB_STATUS: { key: JobStatus; label: string }[] = [
  { key: "running", label: "In esecuzione" },
  { key: "queued", label: "In coda" },
  { key: "completed", label: "Completate" },
  { key: "failed", label: "Fallite" },
  { key: "cancelled", label: "Annullate" },
]

// Overview riservata agli admin: KPI di sistema, andamento e ultime attività.
// È un Server Component: riceve i dati già aggregati (getAdminStats) e renderizza
// markup statico; solo i grafici sono client (Recharts).
export function AdminOverview({ stats }: { stats: AdminStats }) {
  const { users, notes, files, jobs, notifications, daily, recentAudit } = stats

  return (
    <div className="flex flex-col gap-4">
      {/* Riga di KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Utenti</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {nf.format(users.total)}
            </CardTitle>
            <CardAction>
              <UsersIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            {users.newLast7 > 0
              ? `+${nf.format(users.newLast7)} negli ultimi 7 giorni`
              : "Nessuna nuova registrazione (7 giorni)"}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Operazioni attive</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {nf.format(jobs.active)}
            </CardTitle>
            <CardAction>
              <ListChecksIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            {jobs.failedLast7 > 0 ? (
              <span className="text-destructive">
                {nf.format(jobs.failedLast7)} fallite negli ultimi 7 giorni
              </span>
            ) : (
              "In coda o in esecuzione adesso"
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>File</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {nf.format(files.total)}
            </CardTitle>
            <CardAction>
              <FolderIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            {formatSize(files.totalSize)} occupati nello storage
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Note</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {nf.format(notes.total)}
            </CardTitle>
            <CardAction>
              <NotebookPenIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            {notifications.unread > 0
              ? `${nf.format(notifications.unread)} notifiche non lette`
              : "Note salvate da tutti gli utenti"}
          </CardFooter>
        </Card>
      </div>

      {/* Riga dei grafici */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attività di sicurezza</CardTitle>
            <CardDescription>
              Eventi del registro di audit per giorno (ultimi 14 giorni)
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/audit">
                  <ScrollTextIcon data-icon="inline-start" />
                  Audit log
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ActivityChart data={daily} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrazioni</CardTitle>
            <CardDescription>Nuovi utenti per giorno (14 giorni)</CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationsChart data={daily} />
          </CardContent>
        </Card>
      </div>

      {/* Riga di dettaglio: stato utenti + stato operazioni */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stato degli utenti</CardTitle>
            <CardDescription>Composizione della base utenti</CardDescription>
            <CardAction>
              <ShieldCheckIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-semibold tabular-nums">
                {nf.format(users.verified)}
              </span>
              <span className="text-sm text-muted-foreground">
                Email verificata
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-semibold tabular-nums">
                {nf.format(users.twoFactor)}
              </span>
              <span className="text-sm text-muted-foreground">Con 2FA</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-semibold tabular-nums">
                {nf.format(users.banned)}
              </span>
              <span className="text-sm text-muted-foreground">Bannati</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/users">
                Gestione utenti
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operazioni in background</CardTitle>
            <CardDescription>Job per stato</CardDescription>
            <CardAction>
              <ListChecksIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {JOB_STATUS.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">
                  {nf.format(jobs.byStatus[key])}
                </span>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/jobs">
                Vai alle operazioni
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Ultime attività (audit log) */}
      <Card>
        <CardHeader>
          <CardTitle>Ultime attività</CardTitle>
          <CardDescription>
            Eventi recenti del registro di audit
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/audit">
                <ScrollTextIcon data-icon="inline-start" />
                Vedi tutto
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ScrollTextIcon />
                </EmptyMedia>
                <EmptyTitle>Nessuna attività</EmptyTitle>
                <EmptyDescription>
                  Gli eventi tracciati compariranno qui.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Esito</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead className="text-right">Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAudit.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {e.actionLabel}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          e.outcome === "failure" ? "destructive" : "outline"
                        }
                      >
                        {e.outcome === "failure" ? "Fallito" : "OK"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.actorEmail ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {format(parseISO(e.createdAt), "d MMM HH:mm", {
                        locale: it,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
