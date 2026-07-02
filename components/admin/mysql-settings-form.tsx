"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DatabaseIcon, SaveIcon, CableIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { MySqlSettingsAdmin } from "@/lib/settings/schema"

export function MySqlSettingsForm({
  initial,
}: {
  initial: MySqlSettingsAdmin
}) {
  const router = useRouter()

  const [host, setHost] = useState(initial.host)
  const [port, setPort] = useState(initial.port?.toString() ?? "")
  const [user, setUser] = useState(initial.user)
  const [password, setPassword] = useState("")
  const [passwordSet, setPasswordSet] = useState(initial.passwordSet)
  const [removePassword, setRemovePassword] = useState(false)
  const [database, setDatabase] = useState(initial.database)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const busy = saving || testing

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/mysql", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: host.trim(),
          port: port.trim() ? Number(port) : null,
          user: user.trim(),
          ...(password ? { password } : {}),
          removePassword,
          database: database.trim(),
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Operazione non riuscita")
      }
      const saved = (await res.json()) as MySqlSettingsAdmin

      setPasswordSet(saved.passwordSet)
      setPassword("")
      setRemovePassword(false)
      toast.success("Configurazione MySQL salvata")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const res = await fetch("/api/admin/settings/mysql/test", {
        method: "POST",
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      if (!res.ok) throw new Error(data?.error ?? "Connessione non riuscita")
      toast.success("Connessione MySQL riuscita")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSave} className="contents">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseIcon aria-hidden="true" className="size-4" />
            MySQL
          </CardTitle>
          <CardDescription>
            Connessione a un database MySQL esterno per la lettura dei dati.
            La password viene salvata cifrata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">Connessione</FieldLegend>
              <FieldDescription>
                Lascia vuoto un campo per usare il valore predefinito.
              </FieldDescription>
              <div className="grid gap-4 sm:grid-cols-[1fr_minmax(0,9rem)]">
                <Field>
                  <FieldLabel htmlFor="mysql-host">Host</FieldLabel>
                  <Input
                    id="mysql-host"
                    name="host"
                    autoComplete="off"
                    value={host}
                    onChange={(event) => setHost(event.target.value)}
                    placeholder="127.0.0.1"
                    disabled={busy}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="mysql-port">Porta</FieldLabel>
                  <Input
                    id="mysql-port"
                    name="port"
                    type="number"
                    inputMode="numeric"
                    className="tabular-nums"
                    value={port}
                    onChange={(event) => setPort(event.target.value)}
                    placeholder="3306"
                    disabled={busy}
                  />
                  <FieldDescription>Di default 3306.</FieldDescription>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="mysql-database">Database</FieldLabel>
                <Input
                  id="mysql-database"
                  name="database"
                  autoComplete="off"
                  value={database}
                  onChange={(event) => setDatabase(event.target.value)}
                  placeholder="mydb"
                  disabled={busy}
                />
              </Field>
            </FieldSet>

            <FieldSeparator />

            <FieldSet>
              <FieldLegend variant="label">Autenticazione</FieldLegend>
              <FieldDescription>
                Credenziali per l&apos;accesso al database MySQL.
              </FieldDescription>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="mysql-user">Utente</FieldLabel>
                  <Input
                    id="mysql-user"
                    name="username"
                    value={user}
                    onChange={(event) => setUser(event.target.value)}
                    autoComplete="off"
                    placeholder="root"
                    disabled={busy}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="mysql-password">Password</FieldLabel>
                  <Input
                    id="mysql-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder={
                      passwordSet
                        ? "•••••••• (invariata)"
                        : "nessuna password salvata"
                    }
                    disabled={busy || removePassword}
                  />
                  <FieldDescription>
                    Salvata cifrata. Compila solo per cambiarla.
                  </FieldDescription>
                </Field>
              </div>

              {passwordSet && (
                <Field orientation="horizontal">
                  <Checkbox
                    id="mysql-remove-password"
                    checked={removePassword}
                    onCheckedChange={(v) => setRemovePassword(v === true)}
                    disabled={busy}
                  />
                  <FieldLabel
                    htmlFor="mysql-remove-password"
                    className="font-normal"
                  >
                    Rimuovi la password salvata
                  </FieldLabel>
                </Field>
              )}
            </FieldSet>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FieldDescription className="text-balance">
            Verifica la connessione con la configurazione salvata.
          </FieldDescription>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={busy}
            >
              {testing ? (
                <Spinner aria-hidden="true" />
              ) : (
                <CableIcon aria-hidden="true" />
              )}
              Test connessione
            </Button>
            <Button type="submit" disabled={busy}>
              {saving ? (
                <Spinner aria-hidden="true" />
              ) : (
                <SaveIcon data-icon="inline-start" aria-hidden="true" />
              )}
              Salva
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
