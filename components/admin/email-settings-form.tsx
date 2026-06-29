"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SaveIcon, SendIcon } from "lucide-react"
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
  FieldLegend,
  FieldSeparator,
  FieldSet,
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
import type { EmailSettingsAdmin } from "@/lib/settings/schema"

// Form della config EMAIL di sistema (admin). Salva via PUT /api/admin/settings/
// email e può inviare un'email di prova (POST .../test). La password è
// write-only: il campo parte vuoto e si invia solo se compilato; `passwordSet`
// indica se ce n'è già una salvata. Vedi docs/email.md.
export function EmailSettingsForm({ initial }: { initial: EmailSettingsAdmin }) {
  const router = useRouter()

  const [driver, setDriver] = useState(initial.driver)
  const [from, setFrom] = useState(initial.from)
  const [host, setHost] = useState(initial.host)
  const [port, setPort] = useState(initial.port?.toString() ?? "")
  const [secure, setSecure] = useState(initial.secure)
  const [user, setUser] = useState(initial.user)
  const [password, setPassword] = useState("")
  const [passwordSet, setPasswordSet] = useState(initial.passwordSet)
  const [removePassword, setRemovePassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const smtp = driver === "smtp"
  const busy = saving || testing
  // Col driver "console" le email non vengono spedite: i campi del server e
  // dell'autenticazione sono irrilevanti, quindi li disabilitiamo. Restano
  // attivi con "default" (che in produzione usa comunque SMTP) e con "smtp".
  const smtpDisabled = busy || driver === "console"

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver,
          from: from.trim(),
          host: host.trim(),
          port: port.trim() ? Number(port) : null,
          secure,
          user: user.trim(),
          // Invia la password solo se digitata; altrimenti resta invariata.
          ...(password ? { password } : {}),
          removePassword,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Operazione non riuscita")
      }
      const saved = (await res.json()) as EmailSettingsAdmin

      setPasswordSet(saved.passwordSet)
      setPassword("")
      setRemovePassword(false)
      toast.success("Configurazione email salvata")
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
      const res = await fetch("/api/admin/settings/email/test", {
        method: "POST",
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        to?: string
      } | null
      if (!res.ok) throw new Error(data?.error ?? "Invio non riuscito")
      toast.success(`Email di prova inviata a ${data?.to ?? "te"}`)
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
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Server SMTP per l&apos;invio delle email (verifica account, reset
            password, ecc.). La password viene salvata cifrata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">Generale</FieldLegend>
              <Field>
                <FieldLabel htmlFor="email-driver">Driver</FieldLabel>
                <Select
                  value={driver}
                  onValueChange={(v) =>
                    setDriver(v as EmailSettingsAdmin["driver"])
                  }
                  disabled={busy}
                >
                  <SelectTrigger id="email-driver" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      Automatico (console in sviluppo, SMTP in produzione)
                    </SelectItem>
                    <SelectItem value="console">
                      Console (log del server)
                    </SelectItem>
                    <SelectItem value="smtp">SMTP (invio reale)</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Con &quot;Console&quot; le email finiscono nei log e non
                  vengono spedite. Scegli &quot;SMTP&quot; per l&apos;invio
                  reale.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="email-from">Mittente</FieldLabel>
                <Input
                  id="email-from"
                  name="from"
                  autoComplete="off"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  placeholder="Nome <no-reply@example.com>"
                  disabled={busy}
                />
                <FieldDescription>
                  Indirizzo (o &quot;Nome &lt;indirizzo&gt;&quot;) da cui partono
                  le email. Obbligatorio con SMTP.
                </FieldDescription>
              </Field>
            </FieldSet>

            <FieldSeparator />

            <FieldSet>
              <FieldLegend variant="label">Server SMTP</FieldLegend>
              <FieldDescription>
                {driver === "console"
                  ? "Col driver Console questi campi sono ignorati: le email finiscono nei log."
                  : "Lascia vuoto un campo per usare il valore in .env."}
              </FieldDescription>
              <div className="grid gap-4 sm:grid-cols-[1fr_minmax(0,9rem)]">
                <Field>
                  <FieldLabel htmlFor="email-host">Host</FieldLabel>
                  <Input
                    id="email-host"
                    name="host"
                    autoComplete="off"
                    value={host}
                    onChange={(event) => setHost(event.target.value)}
                    placeholder="smtp.example.com"
                    disabled={smtpDisabled}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="email-port">Porta</FieldLabel>
                  <Input
                    id="email-port"
                    name="port"
                    type="number"
                    inputMode="numeric"
                    className="tabular-nums"
                    value={port}
                    onChange={(event) => setPort(event.target.value)}
                    placeholder="587"
                    disabled={smtpDisabled}
                  />
                  <FieldDescription>587 STARTTLS · 465 TLS.</FieldDescription>
                </Field>
              </div>

              <Field orientation="horizontal">
                <Checkbox
                  id="email-secure"
                  checked={secure}
                  onCheckedChange={(v) => setSecure(v === true)}
                  disabled={smtpDisabled}
                />
                <FieldLabel htmlFor="email-secure" className="font-normal">
                  Connessione TLS implicita (porta 465)
                </FieldLabel>
              </Field>
            </FieldSet>

            <FieldSeparator />

            <FieldSet>
              <FieldLegend variant="label">Autenticazione</FieldLegend>
              <FieldDescription>
                Lascia vuoti utente e password per server senza autenticazione.
              </FieldDescription>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="email-user">Utente SMTP</FieldLabel>
                  <Input
                    id="email-user"
                    name="username"
                    value={user}
                    onChange={(event) => setUser(event.target.value)}
                    autoComplete="off"
                    placeholder="utente"
                    disabled={smtpDisabled}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="email-password">Password SMTP</FieldLabel>
                  <Input
                    id="email-password"
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
                    disabled={smtpDisabled || removePassword}
                  />
                  <FieldDescription>
                    Salvata cifrata. Compila solo per cambiarla.
                  </FieldDescription>
                </Field>
              </div>

              {passwordSet && (
                <Field orientation="horizontal">
                  <Checkbox
                    id="email-remove-password"
                    checked={removePassword}
                    onCheckedChange={(v) => setRemovePassword(v === true)}
                    disabled={smtpDisabled}
                  />
                  <FieldLabel
                    htmlFor="email-remove-password"
                    className="font-normal"
                  >
                    Rimuovi la password salvata (torna al valore in .env)
                  </FieldLabel>
                </Field>
              )}
            </FieldSet>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FieldDescription className="text-balance">
            La prova usa la configurazione <strong>salvata</strong>: salva prima
            di inviarla. La mail arriva al tuo indirizzo.
          </FieldDescription>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={busy || !smtp}
              title={
                smtp
                  ? "Invia un'email di prova alla tua casella"
                  : "Disponibile solo con il driver SMTP"
              }
            >
              {testing ? <Spinner aria-hidden="true" /> : <SendIcon aria-hidden="true" />}
              Invia email di prova
            </Button>
            <Button type="submit" disabled={busy}>
              {saving ? <Spinner aria-hidden="true" /> : <SaveIcon data-icon="inline-start" aria-hidden="true" />}
              Salva
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
