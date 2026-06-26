"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { SystemSettings } from "@/lib/settings/schema"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

// Form delle impostazioni di sistema (globali). Invia un patch a
// PUT /api/admin/settings; il server valida, salva e invalida la cache, così la
// modifica (es. logo) si propaga a tutti. `router.refresh()` ricarica i Server
// Component della pagina con i valori aggiornati.
export function SystemSettingsForm({ initial }: { initial: SystemSettings }) {
  const router = useRouter()
  const [appName, setAppName] = useState(initial.appName)
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "")
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: appName.trim(),
          // Stringa vuota → null: nessun logo, si usa l'icona di default.
          logoUrl: logoUrl.trim() === "" ? null : logoUrl.trim(),
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Errore durante il salvataggio")
      }

      toast.success("Impostazioni salvate")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="app-name">Nome del software</FieldLabel>
          <Input
            id="app-name"
            value={appName}
            onChange={(event) => setAppName(event.target.value)}
            placeholder="shadcn starter"
            disabled={pending}
            required
          />
          <FieldDescription>
            Mostrato nell&apos;header della sidebar e nel titolo della pagina.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="logo-url">URL del logo</FieldLabel>
          <Input
            id="logo-url"
            type="url"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            placeholder="https://… (lascia vuoto per l'icona di default)"
            disabled={pending}
          />
          <FieldDescription>
            Immagine mostrata nella sidebar. Vuoto = icona predefinita.
          </FieldDescription>
        </Field>

        <Button type="submit" disabled={pending || !appName.trim()}>
          {pending && <Spinner />}
          Salva
        </Button>
      </FieldGroup>
    </form>
  )
}
