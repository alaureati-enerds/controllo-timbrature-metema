import Link from "next/link"
import { format, parseISO } from "date-fns"
import { it } from "date-fns/locale"
import {
  ArrowRightIcon,
  BellIcon,
  CheckCircle2Icon,
  FolderIcon,
  KeyRoundIcon,
  MailIcon,
  NotebookPenIcon,
  ShieldCheckIcon,
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
import { Separator } from "@/components/ui/separator"
import { listNotes } from "@/lib/notes"
import { listUserFiles } from "@/lib/files"
import { listNotifications } from "@/lib/notifications"

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const nf = new Intl.NumberFormat("it-IT")

type SecurityUser = {
  emailVerified: boolean
  twoFactorEnabled: boolean
}

// Vista personale della dashboard (utenti non admin): le proprie risorse, lo
// stato di sicurezza dell'account e gli ultimi elementi. È un Server Component:
// legge i service per-ownership e renderizza markup statico.
export async function PersonalOverview({
  userId,
  user,
}: {
  userId: string
  user: SecurityUser
}) {
  const [notes, files, notifs] = await Promise.all([
    listNotes(userId),
    listUserFiles(userId),
    listNotifications(userId, { limit: 5 }),
  ])
  const filesTotalSize = files.reduce((sum, f) => sum + f.size, 0)
  const recentNotes = notes.slice(0, 5)

  return (
    <div className="flex flex-col gap-4">
      {/* KPI personali */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Le mie note</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {nf.format(notes.length)}
            </CardTitle>
            <CardAction>
              <NotebookPenIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" size="sm" asChild>
              <Link href="/notes">
                Vai alle note
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>I miei file</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {nf.format(files.length)}
            </CardTitle>
            <CardAction>
              <FolderIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-3">
            <span className="text-sm text-muted-foreground">
              {formatSize(filesTotalSize)} occupati
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/files">
                Vai ai file
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Notifiche non lette</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {nf.format(notifs.unread)}
            </CardTitle>
            <CardAction>
              <BellIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" size="sm" asChild>
              <Link href="/notifications">
                Vai alle notifiche
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Sicurezza dell'account */}
      <Card>
        <CardHeader>
          <CardTitle>Sicurezza dell&apos;account</CardTitle>
          <CardDescription>
            Tieni al sicuro il tuo accesso completando questi passaggi.
          </CardDescription>
          <CardAction>
            <ShieldCheckIcon className="text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SecurityRow
            icon={<MailIcon className="size-5 text-muted-foreground" />}
            title="Email verificata"
            description="Conferma il tuo indirizzo per ricevere le comunicazioni."
            done={user.emailVerified}
            doneLabel="Verificata"
            ctaLabel="Verifica email"
          />
          <Separator />
          <SecurityRow
            icon={<KeyRoundIcon className="size-5 text-muted-foreground" />}
            title="Verifica in due passaggi (2FA)"
            description="Aggiungi un secondo fattore per proteggere l'accesso."
            done={user.twoFactorEnabled}
            doneLabel="Attiva"
            ctaLabel="Attiva 2FA"
          />
        </CardContent>
      </Card>

      {/* Note recenti + ultime notifiche */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Note recenti</CardTitle>
            <CardDescription>Le tue ultime note</CardDescription>
            <CardAction>
              <NotebookPenIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {recentNotes.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <NotebookPenIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nessuna nota</EmptyTitle>
                  <EmptyDescription>
                    Le note che crei compariranno qui.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-1">
                {recentNotes.map((note) => (
                  <li key={note.id}>
                    <Link
                      href={`/notes/${note.id}`}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
                    >
                      <span className="truncate">{note.text}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {format(note.createdAt, "d MMM", { locale: it })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ultime notifiche</CardTitle>
            <CardDescription>Gli avvisi più recenti</CardDescription>
            <CardAction>
              <BellIcon className="text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {notifs.entries.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BellIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nessuna notifica</EmptyTitle>
                  <EmptyDescription>
                    Qui vedrai gli avvisi che ti riguardano.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-1">
                {notifs.entries.map((n) => {
                  const inner = (
                    <>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium">{n.title}</span>
                        <span className="truncate text-muted-foreground">
                          {n.body}
                        </span>
                      </div>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {format(parseISO(n.createdAt), "d MMM", { locale: it })}
                      </span>
                    </>
                  )
                  const cls =
                    "flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm"
                  return (
                    <li key={n.id}>
                      {n.url ? (
                        <Link href={n.url} className={`${cls} hover:bg-accent`}>
                          {inner}
                        </Link>
                      ) : (
                        <div className={cls}>{inner}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Riga della card sicurezza: fatto → badge "Attiva/Verificata"; da fare → CTA
// che porta al profilo, dove si gestiscono email e 2FA.
function SecurityRow({
  icon,
  title,
  description,
  done,
  doneLabel,
  ctaLabel,
}: {
  icon: React.ReactNode
  title: string
  description: string
  done: boolean
  doneLabel: string
  ctaLabel: string
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>
      <div className="ml-auto shrink-0">
        {done ? (
          <Badge variant="outline">
            <CheckCircle2Icon data-icon="inline-start" />
            {doneLabel}
          </Badge>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href="/profile">
              {ctaLabel}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
