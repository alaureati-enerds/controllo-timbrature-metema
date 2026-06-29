"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { IconPicker } from "@/components/admin/icon-picker"
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
import type { BrandingIconName } from "@/lib/settings/icons"
import type { SystemSettings } from "@/lib/settings/schema"

// Form delle impostazioni di sistema. Salva nome, sottotitolo e icona via
// PUT /api/admin/settings (JSON); `router.refresh()` propaga le modifiche
// all'header della sidebar. La <form> usa `display:contents` così l'azione
// può vivere nel CardFooter restando dentro il form (un solo submit).
export function SystemSettingsForm({ initial }: { initial: SystemSettings }) {
  const router = useRouter()

  const [appName, setAppName] = useState(initial.appName)
  const [appSubtitle, setAppSubtitle] = useState(initial.appSubtitle)
  const [iconName, setIconName] = useState<BrandingIconName>(initial.iconName)
  const [saving, setSaving] = useState(false)

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: appName.trim(),
          appSubtitle: appSubtitle.trim(),
          iconName,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Operazione non riuscita")
      }

      toast.success("Impostazioni salvate")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSave} className="contents">
        <CardHeader>
          <CardTitle>Identità</CardTitle>
          <CardDescription>
            Nome, sottotitolo e icona mostrati nell&apos;interfaccia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="app-name">Nome del software</FieldLabel>
                <Input
                  id="app-name"
                  name="appName"
                  autoComplete="off"
                  value={appName}
                  onChange={(event) => setAppName(event.target.value)}
                  placeholder="shadcn starter"
                  disabled={saving}
                  required
                />
                <FieldDescription>
                  Mostrato nell&apos;header della sidebar e nel titolo della
                  pagina.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="app-subtitle">Sottotitolo</FieldLabel>
                <Input
                  id="app-subtitle"
                  name="appSubtitle"
                  autoComplete="off"
                  value={appSubtitle}
                  onChange={(event) => setAppSubtitle(event.target.value)}
                  placeholder="Dashboard"
                  disabled={saving}
                />
                <FieldDescription>
                  Riga piccola sotto il nome. Lascia vuoto per nasconderla.
                </FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel>Icona</FieldLabel>
              <IconPicker
                value={iconName}
                onChange={setIconName}
                disabled={saving}
              />
              <FieldDescription>
                Mostrata nell&apos;header della sidebar accanto al nome.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={saving || !appName.trim()}>
            {saving ? <Spinner /> : <SaveIcon data-icon="inline-start" />}
            Salva
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
