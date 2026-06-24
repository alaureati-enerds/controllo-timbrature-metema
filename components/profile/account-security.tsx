"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
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

  async function handleDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
    toast.success(
      "Link di conferma inviato alla tua email (in dev: nei log)."
    )
    router.refresh()
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {/* Sessioni attive */}
      <Card>
        <CardHeader>
          <CardTitle>Sessioni attive</CardTitle>
          <CardDescription>
            Dispositivi/accessi collegati al tuo account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loadingSessions ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner /> Caricamento…
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {sessions.map((s) => {
                  const isCurrent = s.token === currentToken
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">
                          {s.userAgent || "Client sconosciuto"}
                          {isCurrent && (
                            <span className="text-muted-foreground">
                              {" "}
                              · questa sessione
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {s.ipAddress || "—"} ·{" "}
                          {new Date(s.createdAt).toLocaleString("it-IT")}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isCurrent || busyToken === s.token}
                        onClick={() => revokeOne(s.token)}
                      >
                        Revoca
                      </Button>
                    </li>
                  )
                })}
              </ul>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyToken === "__others__"}
                  onClick={revokeOthers}
                >
                  {busyToken === "__others__" && <Spinner />}
                  Disconnetti le altre sessioni
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cambio email */}
      <Card>
        <CardHeader>
          <CardTitle>Cambia email</CardTitle>
          <CardDescription>
            Email attuale: {currentEmail}. Riceverai un link di conferma sulla
            nuova email.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleChangeEmail}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-email">Nuova email</FieldLabel>
                <Input
                  id="new-email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={changingEmail}
                />
              </Field>
              <Button type="submit" disabled={changingEmail}>
                {changingEmail && <Spinner />}
                Invia conferma
              </Button>
            </FieldGroup>
          </CardContent>
        </form>
      </Card>

      {/* Eliminazione account */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Elimina account</CardTitle>
          <CardDescription>
            Operazione irreversibile. Per confermare digita la tua email e invia:
            riceverai un link di conferma finale.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleDelete}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="confirm-email">
                  Conferma email ({currentEmail})
                </FieldLabel>
                <Input
                  id="confirm-email"
                  type="email"
                  autoComplete="off"
                  required
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  disabled={deleting}
                />
              </Field>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleting || confirmEmail !== currentEmail}
              >
                {deleting && <Spinner />}
                Elimina il mio account
              </Button>
            </FieldGroup>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
