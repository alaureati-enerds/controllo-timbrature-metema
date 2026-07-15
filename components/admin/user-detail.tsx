"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ArrowLeftIcon,
  BanIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LaptopIcon,
  LogInIcon,
  LogOutIcon,
  MailIcon,
  RefreshCwIcon,
  SaveIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  Trash2Icon,
  UserCheckIcon,
} from "lucide-react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type DetailUser = {
  id: string
  name: string
  email: string
  image?: string | null
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

// Genera una password casuale robusta (per il reset lato admin). Usa la WebCrypto
// per l'entropia; il set di caratteri esclude quelli ambigui (O/0, l/1).
function generatePassword(length = 16): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*?"
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (v) => chars[v % chars.length]).join("")
}

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
  // Azione in corso: stringa identificativa (es. "role", "password",
  // "session:<token>"), così lo spinner appare solo sul bottone giusto mentre
  // un'unica operazione alla volta blocca le altre.
  const [busy, setBusy] = useState<string | null>(null)
  const isBusy = busy !== null

  // Form ruolo / email / password / ban
  const [role, setRole] = useState<(typeof ROLES)[number]>("user")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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
    setBusy("role")
    const { error } = await authClient.admin.setRole({ userId, role })
    setBusy(null)
    if (error) return toast.error(error.message ?? "Aggiornamento non riuscito")
    toast.success("Ruolo aggiornato")
    refresh()
  }

  // Cambio email lato admin: aggiorna l'indirizzo DIRETTAMENTE, senza inviare
  // alcun link di conferma (a differenza del self-service, che verifica sempre
  // se l'email attuale è verificata). Passiamo emailVerified: true così il nuovo
  // indirizzo nasce già verificato e l'utente può accedere subito — utile in
  // locale con email fittizie. Richiede il permesso `user:set-email`, che il
  // ruolo admin possiede.
  async function saveEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("email")
    const { error } = await authClient.admin.updateUser({
      userId,
      data: { email: newEmail.trim().toLowerCase(), emailVerified: true },
    })
    setBusy(null)
    if (error) return toast.error(error.message ?? "Cambio email non riuscito")
    setNewEmail("")
    toast.success("Email aggiornata")
    refresh()
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("password")
    const { error } = await authClient.admin.setUserPassword({
      userId,
      newPassword,
    })
    if (error) {
      setBusy(null)
      return toast.error(error.message ?? "Reset password non riuscito")
    }
    // Per sicurezza, dopo il reset disconnetti tutte le sessioni dell'utente:
    // dovrà rifare login con la nuova password.
    await authClient.admin.revokeUserSessions({ userId })
    setBusy(null)
    setNewPassword("")
    setShowPassword(false)
    toast.success("Password reimpostata; sessioni dell'utente revocate")
    refresh()
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(newPassword)
      toast.success("Password copiata")
    } catch {
      toast.error("Copia non riuscita")
    }
  }

  async function applyBan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const duration = BAN_DURATIONS.find((d) => d.label === banDuration)
    setBusy("ban")
    const { error } = await authClient.admin.banUser({
      userId,
      banReason: banReason || undefined,
      ...(duration?.seconds ? { banExpiresIn: duration.seconds } : {}),
    })
    setBusy(null)
    if (error) return toast.error(error.message ?? "Ban non riuscito")
    setBanReason("")
    toast.success("Utente bannato")
    refresh()
  }

  async function unban() {
    setBusy("unban")
    const { error } = await authClient.admin.unbanUser({ userId })
    setBusy(null)
    if (error) return toast.error(error.message ?? "Operazione non riuscita")
    toast.success("Utente riabilitato")
    refresh()
  }

  async function revokeSession(sessionToken: string) {
    setBusy(`session:${sessionToken}`)
    const { error } = await authClient.admin.revokeUserSession({ sessionToken })
    setBusy(null)
    if (error) return toast.error(error.message ?? "Revoca non riuscita")
    toast.success("Sessione revocata")
    refresh()
  }

  async function revokeAll() {
    setBusy("sessions")
    const { error } = await authClient.admin.revokeUserSessions({ userId })
    setBusy(null)
    if (error) return toast.error(error.message ?? "Operazione non riuscita")
    toast.success("Tutte le sessioni revocate")
    refresh()
  }

  async function resetTwoFactor() {
    setBusy("2fa")
    const res = await fetch(`/api/admin/users/${userId}/reset-2fa`, {
      method: "POST",
    })
    setBusy(null)
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
    setBusy("impersonate")
    const { error } = await authClient.admin.impersonateUser({ userId })
    setBusy(null)
    if (error) return toast.error(error.message ?? "Impersonificazione fallita")
    toast.success("Stai impersonando l'utente")
    router.push("/")
    router.refresh()
  }

  async function remove() {
    setBusy("delete")
    const { error } = await authClient.admin.removeUser({ userId })
    setBusy(null)
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
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
          <Link href="/admin/users">
            <ArrowLeftIcon data-icon="inline-start" />
            Utenti
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Dettaglio utente
        </h1>
      </div>

      {/* Account: identità + ruolo. */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Identità dell&apos;utente e ruolo, che determina i permessi e
            l&apos;accesso alle aree riservate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="size-14 rounded-xl">
                {user.image && (
                  <AvatarImage src={user.image} alt="" className="rounded-xl" />
                )}
                <AvatarFallback className="rounded-xl text-base font-medium">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-lg font-semibold tracking-tight">
                  {user.name}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {user.email}
                </span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
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
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="role">Ruolo</FieldLabel>
                <Select
                  value={role}
                  disabled={isBusy || isSelf}
                  onValueChange={(v) => setRole(v as (typeof ROLES)[number])}
                >
                  <SelectTrigger id="role" className="w-full sm:max-w-xs">
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
                {isSelf && (
                  <FieldDescription>
                    Non puoi modificare il tuo ruolo.
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          {!isSelf && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isBusy}>
                  {busy === "impersonate" ? (
                    <Spinner />
                  ) : (
                    <LogInIcon data-icon="inline-start" />
                  )}
                  Accedi come questo utente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Accedere come {user.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Assumerai temporaneamente l&apos;identità di questo utente.
                    La sessione corrente verrà sostituita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={impersonate}>
                    <LogInIcon data-icon="inline-start" />
                    Accedi
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            onClick={saveRole}
            disabled={isBusy || isSelf || role === user.role}
          >
            {busy === "role" ? <Spinner /> : <SaveIcon data-icon="inline-start" />}
            Salva ruolo
          </Button>
        </CardFooter>
      </Card>

      {/* Cambia email: aggiornamento diretto senza verifica (bypass admin). */}
      <Card>
        <CardHeader>
          <CardTitle>Cambia email</CardTitle>
          <CardDescription>
            Aggiorna l&apos;indirizzo dell&apos;utente all&apos;istante, senza
            inviare alcun link di conferma: il nuovo indirizzo nasce già
            verificato. A differenza del cambio email fatto dall&apos;utente dal
            proprio profilo, che richiede sempre la verifica.
          </CardDescription>
        </CardHeader>
        <form onSubmit={saveEmail} className="contents">
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-email">Nuova email</FieldLabel>
                <Input
                  id="new-email"
                  type="email"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={user.email}
                  disabled={isBusy}
                  className="w-full sm:max-w-md"
                />
                <FieldDescription>
                  Email attuale: <span className="font-medium">{user.email}</span>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="submit"
              disabled={
                isBusy ||
                newEmail.trim() === "" ||
                newEmail.trim().toLowerCase() === user.email.toLowerCase()
              }
            >
              {busy === "email" ? (
                <Spinner />
              ) : (
                <MailIcon data-icon="inline-start" />
              )}
              Aggiorna email
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Accesso: ban / sblocco. */}
      <Card>
        <CardHeader>
          <CardTitle>Accesso</CardTitle>
          <CardDescription>
            Banna (con motivo e scadenza) o riabilita l&apos;utente.
          </CardDescription>
        </CardHeader>
        {user.banned ? (
          <CardFooter className="justify-end">
            <Button variant="outline" onClick={unban} disabled={isBusy}>
              {busy === "unban" ? (
                <Spinner />
              ) : (
                <UserCheckIcon data-icon="inline-start" />
              )}
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
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="ban-reason">Motivo</FieldLabel>
                    <Input
                      id="ban-reason"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Es. violazione dei termini…"
                      disabled={isBusy}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ban-duration">Durata</FieldLabel>
                    <Select
                      value={banDuration}
                      onValueChange={setBanDuration}
                      disabled={isBusy}
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
                </div>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" variant="destructive" disabled={isBusy}>
                {busy === "ban" ? (
                  <Spinner />
                ) : (
                  <BanIcon data-icon="inline-start" />
                )}
                Banna utente
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>

      {/* Reset password. */}
      <Card>
        <CardHeader>
          <CardTitle>Reimposta password</CardTitle>
          <CardDescription>
            Imposta una nuova password; le sessioni attive verranno revocate.
            Generane una sicura o scrivila a mano, poi comunicala all&apos;utente.
          </CardDescription>
        </CardHeader>
        <form onSubmit={savePassword} className="contents">
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-pw">Nuova password</FieldLabel>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="new-pw"
                      type={showPassword ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      minLength={8}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isBusy}
                      className="pr-9 font-mono"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={
                        showPassword ? "Nascondi password" : "Mostra password"
                      }
                      className="absolute top-1/2 right-1.5 -translate-y-1/2"
                      onClick={() => setShowPassword((s) => !s)}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </Button>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Genera password sicura"
                        disabled={isBusy}
                        onClick={() => {
                          setNewPassword(generatePassword())
                          setShowPassword(true)
                        }}
                      >
                        <RefreshCwIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Genera</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Copia password"
                        disabled={isBusy || !newPassword}
                        onClick={copyPassword}
                      >
                        <CopyIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copia</TooltipContent>
                  </Tooltip>
                </div>
                <FieldDescription>Almeno 8 caratteri.</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={isBusy}>
              {busy === "password" ? (
                <Spinner />
              ) : (
                <KeyRoundIcon data-icon="inline-start" />
              )}
              Reimposta
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Autenticazione a due fattori (recupero da lockout). */}
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
        <CardFooter className="justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isBusy || isSelf || !user.twoFactorEnabled}
                title={
                  isSelf
                    ? "Gestisci la tua 2FA dal profilo"
                    : !user.twoFactorEnabled
                      ? "L'utente non ha la 2FA attiva"
                      : undefined
                }
              >
                {busy === "2fa" ? (
                  <Spinner />
                ) : (
                  <ShieldXIcon data-icon="inline-start" />
                )}
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
                <AlertDialogCancel disabled={isBusy}>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={resetTwoFactor}>
                  Reimposta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>

      {/* Sessioni dell'utente. */}
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
                    <LaptopIcon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {s.userAgent || "Client sconosciuto"}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {s.ipAddress || "—"} ·{" "}
                      {new Date(s.createdAt).toLocaleString("it-IT")}
                    </span>
                  </div>
                  <RevokeSessionButton
                    busy={busy === `session:${s.token}`}
                    disabled={isBusy}
                    onConfirm={() => revokeSession(s.token)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        {sessions.length > 0 && (
          <CardFooter className="justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={revokeAll}
              disabled={isBusy}
            >
              {busy === "sessions" ? (
                <Spinner />
              ) : (
                <LogOutIcon data-icon="inline-start" />
              )}
              Revoca tutte le sessioni
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Danger zone: eliminazione definitiva. */}
      <Card className="border-destructive/30 ring-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlertIcon aria-hidden="true" className="size-4" />
            Elimina account
          </CardTitle>
          <CardDescription>
            Operazione irreversibile: l&apos;account e tutti i suoi dati vengono
            rimossi.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isBusy || isSelf}>
                {busy === "delete" ? (
                  <Spinner />
                ) : (
                  <Trash2Icon data-icon="inline-start" />
                )}
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
                <AlertDialogAction variant="destructive" onClick={remove}>
                  <Trash2Icon data-icon="inline-start" />
                  Elimina
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </>
  )
}

function RevokeSessionButton({
  busy,
  disabled,
  onConfirm,
}: {
  busy: boolean
  disabled: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Revoca questa sessione"
              disabled={disabled}
            >
              {busy ? <Spinner /> : <LogOutIcon />}
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Revoca sessione</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revocare questa sessione?</AlertDialogTitle>
          <AlertDialogDescription>
            Il dispositivo collegato dovrà accedere di nuovo per continuare.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            <LogOutIcon data-icon="inline-start" />
            Revoca
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
