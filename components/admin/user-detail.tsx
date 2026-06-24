"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

type DetailUser = {
  id: string
  name: string
  email: string
  role?: string | null
  banned?: boolean | null
  banReason?: string | null
  banExpires?: Date | string | null
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
    if (!user) return
    if (!confirm(`Eliminare definitivamente ${user.email}?`)) return
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
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Utente non trovato.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/users">← Torna agli utenti</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" asChild className="self-start px-0">
          <Link href="/admin/users">← Utenti</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
        <p className="text-sm text-muted-foreground">
          {user.email} · ruolo {user.role ?? "user"} ·{" "}
          {user.banned ? (
            <span className="text-destructive">
              bannato
              {user.banReason ? ` (${user.banReason})` : ""}
              {user.banExpires
                ? ` fino al ${new Date(user.banExpires).toLocaleString("it-IT")}`
                : ""}
            </span>
          ) : (
            "attivo"
          )}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ruolo */}
        <Card>
          <CardHeader>
            <CardTitle>Ruolo</CardTitle>
            <CardDescription>Assegna il ruolo dell&apos;utente.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={role}
              disabled={busy}
              onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
              Imposta una nuova password per l&apos;utente.
            </CardDescription>
          </CardHeader>
          <form onSubmit={savePassword}>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="new-pw">Nuova password</FieldLabel>
                  <Input
                    id="new-pw"
                    type="text"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={busy}
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  Reimposta
                </Button>
              </FieldGroup>
            </CardContent>
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
          <CardContent>
            {user.banned ? (
              <Button variant="outline" onClick={unban} disabled={busy}>
                Riabilita utente
              </Button>
            ) : isSelf ? (
              <p className="text-sm text-muted-foreground">
                Non puoi bannare te stesso.
              </p>
            ) : (
              <form onSubmit={applyBan}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="ban-reason">Motivo</FieldLabel>
                    <Input
                      id="ban-reason"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Es. violazione termini"
                      disabled={busy}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ban-duration">Durata</FieldLabel>
                    <select
                      id="ban-duration"
                      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                      value={banDuration}
                      onChange={(e) => setBanDuration(e.target.value)}
                      disabled={busy}
                    >
                      {BAN_DURATIONS.map((d) => (
                        <option key={d.label} value={d.label}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button type="submit" variant="destructive" disabled={busy}>
                    Banna utente
                  </Button>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Azioni varie */}
        <Card>
          <CardHeader>
            <CardTitle>Azioni</CardTitle>
            <CardDescription>Impersonificazione ed eliminazione.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-2">
            <Button
              variant="outline"
              onClick={impersonate}
              disabled={busy || isSelf}
              title={isSelf ? "Non puoi impersonare te stesso" : undefined}
            >
              Accedi come questo utente
            </Button>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={busy || isSelf}
              title={isSelf ? "Non puoi eliminare te stesso" : undefined}
            >
              Elimina utente
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sessioni dell'utente */}
      <Card>
        <CardHeader>
          <CardTitle>Sessioni</CardTitle>
          <CardDescription>
            Sessioni attive dell&apos;utente; puoi revocarle.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna sessione attiva.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">
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
                      disabled={busy}
                      onClick={() => revokeSession(s.token)}
                    >
                      Revoca
                    </Button>
                  </li>
                ))}
              </ul>
              <div>
                <Button variant="outline" size="sm" onClick={revokeAll} disabled={busy}>
                  Revoca tutte le sessioni
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
