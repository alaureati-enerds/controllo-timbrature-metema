"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
    <form onSubmit={handleSave}>
      <FieldGroup>
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
              <SelectItem value="console">Console (log del server)</SelectItem>
              <SelectItem value="smtp">SMTP (invio reale)</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>
            Con &quot;Console&quot; le email finiscono nei log e non vengono
            spedite. Scegli &quot;SMTP&quot; per l&apos;invio reale.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="email-from">Mittente</FieldLabel>
          <Input
            id="email-from"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            placeholder="Nome <no-reply@example.com>"
            disabled={busy}
          />
          <FieldDescription>
            Indirizzo (o &quot;Nome &lt;indirizzo&gt;&quot;) da cui partono le
            email. Obbligatorio con SMTP. Vuoto = usa il valore in .env.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="email-host">Host SMTP</FieldLabel>
          <Input
            id="email-host"
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder="smtp.example.com"
            disabled={busy}
          />
          <FieldDescription>Vuoto = usa il valore in .env.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="email-port">Porta</FieldLabel>
          <Input
            id="email-port"
            type="number"
            inputMode="numeric"
            value={port}
            onChange={(event) => setPort(event.target.value)}
            placeholder="587"
            disabled={busy}
          />
          <FieldDescription>
            587 per STARTTLS, 465 per TLS implicito. Vuoto = usa .env (default 587).
          </FieldDescription>
        </Field>

        <Field orientation="horizontal">
          <Checkbox
            id="email-secure"
            checked={secure}
            onCheckedChange={(v) => setSecure(v === true)}
            disabled={busy}
          />
          <FieldLabel htmlFor="email-secure" className="font-normal">
            Connessione TLS implicita (porta 465)
          </FieldLabel>
        </Field>

        <Field>
          <FieldLabel htmlFor="email-user">Utente SMTP</FieldLabel>
          <Input
            id="email-user"
            value={user}
            onChange={(event) => setUser(event.target.value)}
            autoComplete="off"
            placeholder="utente"
            disabled={busy}
          />
          <FieldDescription>
            Lascia vuoto (utente e password) per server senza autenticazione.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="email-password">Password SMTP</FieldLabel>
          <Input
            id="email-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={
              passwordSet ? "•••••••• (invariata)" : "nessuna password salvata"
            }
            disabled={busy || removePassword}
          />
          <FieldDescription>
            È un segreto: viene salvata cifrata e non viene mai più rimostrata.
            Compila solo per impostarla o cambiarla.
          </FieldDescription>
          {passwordSet && (
            <Field orientation="horizontal">
              <Checkbox
                id="email-remove-password"
                checked={removePassword}
                onCheckedChange={(v) => setRemovePassword(v === true)}
                disabled={busy}
              />
              <FieldLabel
                htmlFor="email-remove-password"
                className="font-normal"
              >
                Rimuovi la password salvata (torna al valore in .env)
              </FieldLabel>
            </Field>
          )}
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {saving && <Spinner />}
            Salva
          </Button>
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
            {testing && <Spinner />}
            Invia email di prova
          </Button>
        </div>
        <FieldDescription>
          La prova usa la configurazione <strong>salvata</strong>: salva prima di
          inviarla. La mail arriva al tuo indirizzo.
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}
