"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeftIcon, LaptopIcon, ShieldCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { initials } from "@/lib/initials"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"

type DetailUser = {
  id: string
  name: string
  email: string
  role?: string | null
  banned?: boolean | null
  banReason?: string | null
  banExpires?: Date | string | null
  twoFactorEnabled?: boolean | null
}

type SessionRow = {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: Date | string
}

const ROLES = ["user", "admin"] as const

// Durate di ban in secondi (null = permanente).
const BAN_DURATIONS = [
  { label: "Permanente", seconds: null },
  { label: "1 ora", seconds: 3600 },
  { label: "1 giorno", seconds: 86400 },
  { label: "7 giorni", seconds: 604800 },
  { label: "30 giorni", seconds: 2592000 },
] as const

export function UserDetail({
  userId,
  currentUserId,
}: {
  userId: string
  currentUserId: string
}) {
  const router = useRouter()
  const isSelf = userId === currentUserId

  const [user, setUser] = useState<DetailUser | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState(false)

  // Form ruolo / password / ban
  const [role, setRole] = useState<(typeof ROLES)[number]>("user")
  const [newPassword, setNewPassword] = useState("")
  const [banReason, setBanReason] = useState("")
  const [banDuration, setBanDuration] = useState<string>("Permanente")

  useEffect(() => {
    let active = true
    Promise.all([
      authClient.admin.getUser({ query: { id: userId } }),
      authClient.admin.listUserSessions({ userId }),
    ]).then(([userRes, sessionsRes]) => {
      if (!active) return
      setLoading(false)
      if (userRes.error) {
        toast.error(userRes.error.message ?? "Utente non trovato")
        return
      }
      const u = userRes.data as DetailUser
      setUser(u)
      setRole((u.role as (typeof ROLES)[number]) ?? "user")
      setSessions((sessionsRes.data?.sessions ?? []) as SessionRow[])
    })
    return () => {
      active = false
    }
  }, [userId, refreshKey])

  const refresh = () => setRefreshKey((k) => k + 1)

  async function saveRole() {
    setBusy(true)
    const { error } = await authClient.admin.setRole({ userId, role })
    setBusy(false)
    if (error) return toast.error(error.message ?? "Aggiornamento non riuscito")
    toast.success("Ruolo aggiornato")
    refresh()
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const { error } = await authClient.admin.setUserPassword({
      userId,
      newPassword,
    })
    if (error) {
      setBusy(false)
      return toast.error(error.message ?? "Reset password non riuscito")
    }
    // Per sicurezza, dopo il reset disconnetti tutte le sessioni dell'utente:
    // dovrà rifare login con la nuova password.
    await authClient.admin.revokeUserSessions({ userId })
    setBusy(false)
    setNewPassword("")
    toast.success("Password reimpostata; sessioni dell'utente revocate")
    refresh()
  }

  async function applyBan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const duration = BAN_DURATIONS.find((d) => d.label === banDuration)
    setBusy(true)
    const { error } = await authClient.admin.banUser({
      userId,
      banReason: banReason || undefined,
      ...(duration?.seconds ? { banExpiresIn: duration.seconds } : {}),
    })
    setBusy(false)
    if (error) return toast.error(error.message ?? "Ban non riuscito")
    setBanReason("")
    toast.success("Utente bannato")
    refresh()
  }

  async function unban() {
    setBusy(true)
    const { error } = await authClient.admin.unbanUser({ userId })
    setBusy(false)
    if (error) return toast.error(error.message ?? "Operazione non riuscita")
    toast.success("Utente riabilitato")
    refresh()
  }

  async function revokeSession(sessionToken: string) {
    setBusy(true)
    const { error } = await authClient.admin.revokeUserSession({ sessionToken })
    setBusy(false)
    if (error) return toast.error(error.message ?? "Revoca non riuscita")
    toast.success("Sessione revocata")
    refresh()
  }

  async function revokeAll() {
    setBusy(true)
    const { error } = await authClient.admin.revokeUserSessions({ userId })
    setBusy(false)
    if (error) return toast.error(error.message ?? "Operazione non riuscita")
    toast.success("Tutte le sessioni revocate")
    refresh()
  }

  async function resetTwoFactor() {
    setBusy(true)
    const res = await fetch(`/api/admin/users/${userId}/reset-2fa`, {
      method: "POST",
    })
    setBusy(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      return toast.error(body?.error ?? "Operazione non riuscita")
    }
    toast.success("2FA reimpostata; l'utente potrà riconfigurarla")
    refresh()
  }

  async function impersonate() {
    setBusy(true)
    const { error } = await authClient.admin.impersonateUser({ userId })
    setBusy(false)
    if (error) return toast.error(error.message ?? "Impersonificazione fallita")
    toast.success("Stai impersonando l'utente")
    router.push("/")
    router.refresh()
  }

  async function remove() {
    setBusy(true)
    const { error } = await authClient.admin.removeUser({ userId })
    setBusy(false)
    if (error) return toast.error(error.message ?? "Eliminazione non riuscita")
    toast.success("Utente eliminato")
    router.push("/admin/users")
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Caricamento…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">Utente non trovato.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/users">
            <ArrowLeftIcon data-icon="inline-start" />
            Torna agli utenti
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href="/admin/users">
          <ArrowLeftIcon data-icon="inline-start" />
          Utenti
        </Link>
      </Button>

      {/* Intestazione identità utente. */}
      <header className="flex flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground sm:flex-row sm:items-center sm:gap-5">
        <Avatar className="size-16 rounded-xl">
          <AvatarFallback className="rounded-xl text-lg font-medium">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {user.name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {user.role ?? "user"}
            </Badge>
            {user.banned ? (
              <Badge variant="destructive">
                Bannato
                {user.banExpires
                  ? ` · fino al ${new Date(user.banExpires).toLocaleDateString("it-IT")}`
                  : " · permanente"}
              </Badge>
            ) : (
              <Badge variant="outline">Attivo</Badge>
            )}
          </div>
          {user.banned && user.banReason && (
            <p className="text-xs text-muted-foreground">
              Motivo del ban: {user.banReason}
            </p>
          )}
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Ruolo */}
        <Card>
          <CardHeader>
            <CardTitle>Ruolo</CardTitle>
            <CardDescription>
              Determina i permessi e l&apos;accesso alle aree riservate.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <Select
              value={role}
              disabled={busy}
              onValueChange={(v) => setRole(v as (typeof ROLES)[number])}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={saveRole} disabled={busy || role === user.role}>
              Salva
            </Button>
          </CardContent>
        </Card>

        {/* Reset password */}
        <Card>
          <CardHeader>
            <CardTitle>Reimposta password</CardTitle>
            <CardDescription>
              Imposta una nuova password; le sessioni attive verranno revocate.
            </CardDescription>
          </CardHeader>
          <form onSubmit={savePassword} className="contents">
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="new-pw">Nuova password</FieldLabel>
                  <Input
                    id="new-pw"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={busy}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={busy}>
                Reimposta
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Ban / Sblocco */}
        <Card>
          <CardHeader>
            <CardTitle>Accesso</CardTitle>
            <CardDescription>
              Banna (con motivo e scadenza) o riabilita l&apos;utente.
            </CardDescription>
          </CardHeader>
          {user.banned ? (
            <CardFooter>
              <Button variant="outline" onClick={unban} disabled={busy}>
                Riabilita utente
              </Button>
            </CardFooter>
          ) : isSelf ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Non puoi bannare te stesso.
              </p>
            </CardContent>
          ) : (
            <form onSubmit={applyBan} className="contents">
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="ban-reason">Motivo</FieldLabel>
                    <Input
                      id="ban-reason"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Es. violazione dei termini…"
                      disabled={busy}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ban-duration">Durata</FieldLabel>
                    <Select
                      value={banDuration}
                      onValueChange={setBanDuration}
                      disabled={busy}
                    >
                      <SelectTrigger id="ban-duration" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BAN_DURATIONS.map((d) => (
                          <SelectItem key={d.label} value={d.label}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <Button type="submit" variant="destructive" disabled={busy}>
                  Banna utente
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>

        {/* Azioni varie */}
        <Card>
          <CardHeader>
            <CardTitle>Azioni</CardTitle>
            <CardDescription>
              Accedi come l&apos;utente o eliminane l&apos;account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-start gap-2">
            <Button
              variant="outline"
              onClick={impersonate}
              disabled={busy || isSelf}
              title={isSelf ? "Non puoi impersonare te stesso" : undefined}
            >
              Accedi come questo utente
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={busy || isSelf}
                  title={isSelf ? "Non puoi eliminare te stesso" : undefined}
                >
                  Elimina utente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare {user.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L&apos;account {user.email} e i suoi dati verranno rimossi
                    definitivamente. L&apos;azione non è reversibile.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={remove}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Elimina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Autenticazione a due fattori (recupero da lockout) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-muted-foreground" />
              Autenticazione a due fattori
              {user.twoFactorEnabled ? (
                <Badge variant="secondary">Attiva</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Non attiva
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Reimposta la 2FA se l&apos;utente ha perso telefono e codici di
              backup. Dovrà riconfigurarla dal proprio profilo.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={busy || isSelf || !user.twoFactorEnabled}
                  title={
                    isSelf
                      ? "Gestisci la tua 2FA dal profilo"
                      : !user.twoFactorEnabled
                        ? "L'utente non ha la 2FA attiva"
                        : undefined
                  }
                >
                  Reimposta 2FA
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Reimpostare la 2FA di {user.name}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    La verifica in due passaggi verrà disattivata e i codici di
                    backup invalidati. {user.name} potrà accedere con la sola
                    password e riconfigurare la 2FA dal profilo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={resetTwoFactor}>
                    Reimposta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </div>

      {/* Sessioni dell'utente */}
      <Card>
        <CardHeader>
          <CardTitle>Sessioni</CardTitle>
          <CardDescription>
            Sessioni attive dell&apos;utente; puoi revocarle singolarmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna sessione attiva.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <LaptopIcon className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {s.userAgent || "Client sconosciuto"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.ipAddress || "—"} ·{" "}
                      {new Date(s.createdAt).toLocaleString("it-IT")}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    disabled={busy}
                    onClick={() => revokeSession(s.token)}
                  >
                    Revoca
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        {sessions.length > 0 && (
          <CardFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={revokeAll}
              disabled={busy}
            >
              Revoca tutte le sessioni
            </Button>
          </CardFooter>
        )}
      </Card>
    </>
  )
}
