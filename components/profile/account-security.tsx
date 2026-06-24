"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { LaptopIcon, ShieldAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
import { Spinner } from "@/components/ui/spinner"

type SessionRow = {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: Date | string
}

export function AccountSecurity({ currentEmail }: { currentEmail: string }) {
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
    toast.success(
      "Link di conferma inviato alla nuova email (in dev: nei log)."
    )
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
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Sicurezza</h2>
        <p className="text-sm text-muted-foreground">
          Gestisci email, accessi attivi ed eliminazione dell&apos;account.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Sessioni attive */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle>Dispositivi e accessi</CardTitle>
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
                        <LaptopIcon className="size-4" />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2 truncate font-medium">
                          <span className="truncate">
                            {s.userAgent || "Client sconosciuto"}
                          </span>
                          {isCurrent && (
                            <Badge variant="secondary">Questa sessione</Badge>
                          )}
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
                        disabled={isCurrent || busyToken === s.token}
                        onClick={() => revokeOne(s.token)}
                      >
                        {busyToken === s.token && <Spinner />}
                        Revoca
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
          {otherSessions.length > 0 && (
            <CardFooter>
              <Button
                variant="outline"
                size="sm"
                disabled={busyToken === "__others__"}
                onClick={revokeOthers}
              >
                {busyToken === "__others__" && <Spinner />}
                Disconnetti le altre sessioni
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Cambio email */}
        <Card>
          <CardHeader>
            <CardTitle>Cambia email</CardTitle>
            <CardDescription>
              Email attuale: <span className="font-medium">{currentEmail}</span>.
              Riceverai un link di conferma sulla nuova email.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleChangeEmail} className="contents">
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="new-email">Nuova email</FieldLabel>
                  <Input
                    id="new-email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={changingEmail}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={changingEmail}>
                {changingEmail && <Spinner />}
                Invia conferma
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Eliminazione account */}
      <Card className="border-destructive/30 ring-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlertIcon className="size-4" />
            Elimina account
          </CardTitle>
          <CardDescription>
            Operazione irreversibile: vengono rimossi profilo, note e sessioni.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-between gap-4 border-t-0 bg-transparent">
          <p className="text-sm text-muted-foreground">
            Riceverai un&apos;ultima email di conferma prima dell&apos;eliminazione.
          </p>
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setConfirmEmail("")
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Elimina il mio account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare l&apos;account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Per confermare digita la tua email{" "}
                  <span className="font-medium text-foreground">
                    {currentEmail}
                  </span>
                  . L&apos;azione è definitiva.
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
                <Button
                  variant="destructive"
                  disabled={deleting || confirmEmail !== currentEmail}
                  onClick={handleDelete}
                >
                  {deleting && <Spinner />}
                  Elimina definitivamente
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  )
}
