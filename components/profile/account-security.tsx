"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  BadgeCheckIcon,
  KeyRoundIcon,
  LaptopIcon,
  LogOutIcon,
  MailIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { TwoFactorCard } from "@/components/profile/two-factor-card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type SessionRow = {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: Date | string
}

export function AccountSecurity({
  currentEmail,
  emailVerified,
  twoFactorEnabled,
}: {
  currentEmail: string
  emailVerified: boolean
  twoFactorEnabled: boolean
}) {
  const router = useRouter()
  const { data: current } = authClient.useSession()
  const currentToken = current?.session.token

  // --- Sessioni attive ---
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [busyToken, setBusyToken] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    const { data, error } = await authClient.listSessions()
    setLoadingSessions(false)
    if (error) {
      toast.error(error.message ?? "Impossibile caricare le sessioni")
      return
    }
    setSessions((data ?? []) as SessionRow[])
  }, [])

  useEffect(() => {
    let active = true
    authClient.listSessions().then(({ data, error }) => {
      if (!active) return
      setLoadingSessions(false)
      if (error) {
        toast.error(error.message ?? "Impossibile caricare le sessioni")
        return
      }
      setSessions((data ?? []) as SessionRow[])
    })
    return () => {
      active = false
    }
  }, [])

  async function revokeOne(token: string) {
    setBusyToken(token)
    const { error } = await authClient.revokeSession({ token })
    setBusyToken(null)
    if (error) {
      toast.error(error.message ?? "Revoca non riuscita")
      return
    }
    toast.success("Sessione revocata")
    loadSessions()
  }

  async function revokeOthers() {
    setBusyToken("__others__")
    const { error } = await authClient.revokeOtherSessions()
    setBusyToken(null)
    if (error) {
      toast.error(error.message ?? "Operazione non riuscita")
      return
    }
    toast.success("Altre sessioni disconnesse")
    loadSessions()
  }

  // --- Cambio email ---
  const [emailOpen, setEmailOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [changingEmail, setChangingEmail] = useState(false)

  async function handleChangeEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setChangingEmail(true)
    const { error } = await authClient.changeEmail({
      newEmail,
      callbackURL: "/profile",
    })
    setChangingEmail(false)
    if (error) {
      toast.error(error.message ?? "Cambio email non riuscito")
      return
    }
    setNewEmail("")
    setEmailOpen(false)
    toast.success(
      "Link di conferma inviato alla nuova email (in dev: nei log)."
    )
  }

  // --- Cambio password ---
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingPassword(true)
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    setSavingPassword(false)
    if (error) {
      toast.error(error.message ?? "Cambio password non riuscito")
      return
    }
    toast.success("Password aggiornata")
    setCurrentPassword("")
    setNewPassword("")
    setPasswordOpen(false)
  }

  // --- Eliminazione account ---
  const [confirmEmail, setConfirmEmail] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (confirmEmail !== currentEmail) {
      toast.error("L'email digitata non corrisponde")
      return
    }
    setDeleting(true)
    const { error } = await authClient.deleteUser({ callbackURL: "/login" })
    setDeleting(false)
    if (error) {
      toast.error(error.message ?? "Eliminazione non riuscita")
      return
    }
    toast.success("Link di conferma inviato alla tua email (in dev: nei log).")
    router.refresh()
  }

  const otherSessions = sessions.filter((s) => s.token !== currentToken)

  return (
    <div className="flex flex-col gap-6">
      {/* Cambio email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailIcon aria-hidden="true" className="size-4" />
            Email
          </CardTitle>
          <CardDescription>
            Tieni aggiornato l&apos;indirizzo per recuperare l&apos;account.
            Riceverai un link di conferma sulla nuova email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel>Email attuale</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{currentEmail}</span>
              {emailVerified ? (
                <Badge variant="outline">
                  <BadgeCheckIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                  Verificata
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Da verificare
                </Badge>
              )}
            </div>
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
            <DialogTrigger asChild>
              <Button>
                <MailIcon aria-hidden="true" data-icon="inline-start" />
                Cambia email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cambia email</DialogTitle>
                <DialogDescription>
                  Riceverai un link di conferma sulla nuova email.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleChangeEmail}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="new-email">
                      Nuova email
                    </FieldLabel>
                    <Input
                      id="new-email"
                      type="email"
                      autoComplete="email"
                      spellCheck={false}
                      placeholder="Inserisci il nuovo indirizzo"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={changingEmail}
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter className="mt-6">
                  <Button type="submit" disabled={changingEmail}>
                    {changingEmail ? (
                      <Spinner />
                    ) : (
                      <MailIcon data-icon="inline-start" />
                    )}
                    Invia conferma
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>

      {/* Cambio password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon aria-hidden="true" className="size-4" />
            Password
          </CardTitle>
          <CardDescription>
            Per sicurezza, le altre sessioni verranno disconnesse.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
            <DialogTrigger asChild>
              <Button>
                <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />
                Cambia password
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cambia password</DialogTitle>
                <DialogDescription>
                  Le altre sessioni verranno disconnesse per sicurezza.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handlePasswordSubmit}>
                <FieldGroup>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="current-password">
                        Password attuale
                      </FieldLabel>
                      <Input
                        id="current-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={savingPassword}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="new-password">
                        Nuova password
                      </FieldLabel>
                      <Input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={savingPassword}
                      />
                      <FieldDescription>
                        Almeno 8 caratteri.
                      </FieldDescription>
                    </Field>
                  </div>
                </FieldGroup>
                <DialogFooter className="mt-6">
                  <Button type="submit" disabled={savingPassword}>
                    {savingPassword ? (
                      <Spinner />
                    ) : (
                      <KeyRoundIcon data-icon="inline-start" />
                    )}
                    Aggiorna password
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>

      {/* Autenticazione a due fattori */}
      <TwoFactorCard initialEnabled={twoFactorEnabled} />

      {/* Sessioni attive */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LaptopIcon aria-hidden="true" className="size-4" />
            Dispositivi e accessi
          </CardTitle>
          <CardDescription>
            Sessioni attualmente collegate al tuo account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loadingSessions ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Caricamento…
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna sessione attiva.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.map((s) => {
                const isCurrent = s.token === currentToken
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <LaptopIcon aria-hidden="true" className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {s.userAgent || "Client sconosciuto"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        {s.ipAddress || "—"}
                      </span>
                      <span className="flex items-center gap-2 truncate text-xs text-muted-foreground tabular-nums">
                        {new Date(s.createdAt).toLocaleString("it-IT")}
                        {isCurrent && (
                          <Badge variant="secondary">Questa sessione</Badge>
                        )}
                      </span>
                    </div>
                    {!isCurrent && (
                      <RevokeSessionButton
                        busy={busyToken === s.token}
                        onConfirm={() => revokeOne(s.token)}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
        {otherSessions.length > 0 && (
          <CardFooter className="justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyToken === "__others__"}
                >
                  {busyToken === "__others__" ? (
                    <Spinner />
                  ) : (
                    <LogOutIcon data-icon="inline-start" />
                  )}
                  Disconnetti le altre sessioni
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Disconnettere le altre sessioni?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Tutti gli altri dispositivi dovranno accedere di nuovo.
                    Questa sessione resta attiva.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={revokeOthers}
                  >
                    <LogOutIcon data-icon="inline-start" />
                    Disconnetti
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}
      </Card>

      {/* Eliminazione account */}
      <Card className="border-destructive/30 ring-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlertIcon aria-hidden="true" className="size-4" />
            Elimina account
          </CardTitle>
          <CardDescription>
            Operazione irreversibile: vengono rimossi profilo, file e sessioni.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setConfirmEmail("")
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2Icon data-icon="inline-start" />
                Elimina il mio account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare l&apos;account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Per confermare digita la tua email{" "}
                  <span className="font-medium text-foreground">
                    {currentEmail}
                  </span>
                  . Ti invieremo un ultimo link di conferma: l&apos;account
                  viene eliminato solo dopo averlo aperto. L&apos;operazione è
                  irreversibile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Field>
                <FieldLabel htmlFor="confirm-email">Conferma email</FieldLabel>
                <Input
                  id="confirm-email"
                  type="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  disabled={deleting}
                />
              </Field>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>
                  Annulla
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleting || confirmEmail !== currentEmail}
                  onClick={handleDelete}
                >
                  {deleting ? (
                    <Spinner />
                  ) : (
                    <Trash2Icon data-icon="inline-start" />
                  )}
                  Elimina definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  )
}

// Azione di riga: bottone solo-icona con tooltip e conferma (revocare una
// sessione disconnette quel dispositivo, quindi è un'azione con effetti reali).
function RevokeSessionButton({
  busy,
  onConfirm,
}: {
  busy: boolean
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
              disabled={busy}
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
