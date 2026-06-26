"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { IconPicker } from "@/components/admin/icon-picker"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { BrandingIconName } from "@/lib/settings/icons"
import type { SystemSettings } from "@/lib/settings/schema"

type BrandingMode = SystemSettings["brandingMode"]

// Form delle impostazioni di sistema. I campi testuali e la modalità/icona si
// salvano insieme via PUT /api/admin/settings (JSON). Il LOGO è un file: si
// carica/rimuove subito con endpoint dedicati (multipart) e aggiorna lo stato
// locale, mentre `router.refresh()` propaga le modifiche all'header della sidebar.
export function SystemSettingsForm({ initial }: { initial: SystemSettings }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [appName, setAppName] = useState(initial.appName)
  const [appSubtitle, setAppSubtitle] = useState(initial.appSubtitle)
  const [brandingMode, setBrandingMode] = useState<BrandingMode>(
    initial.brandingMode
  )
  const [iconName, setIconName] = useState<BrandingIconName>(initial.iconName)
  const [logoFileId, setLogoFileId] = useState<string | null>(
    initial.logoFileId
  )

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function readError(res: Response): Promise<string> {
    const data = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    return data?.error ?? "Operazione non riuscita"
  }

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
          brandingMode,
          iconName,
        }),
      })
      if (!res.ok) throw new Error(await readError(res))

      toast.success("Impostazioni salvate")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // permette di ricaricare lo stesso file
    if (!file) return

    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/admin/settings/logo", {
        method: "POST",
        body,
      })
      if (!res.ok) throw new Error(await readError(res))

      const data = (await res.json()) as { logoFileId: string }
      setLogoFileId(data.logoFileId)
      toast.success("Logo caricato")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setUploading(false)
    }
  }

  async function handleLogoRemove() {
    setUploading(true)
    try {
      const res = await fetch("/api/admin/settings/logo", { method: "DELETE" })
      if (!res.ok) throw new Error(await readError(res))

      setLogoFileId(null)
      toast.success("Logo rimosso")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSave}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="app-name">Nome del software</FieldLabel>
          <Input
            id="app-name"
            value={appName}
            onChange={(event) => setAppName(event.target.value)}
            placeholder="shadcn starter"
            disabled={saving}
            required
          />
          <FieldDescription>
            Mostrato nell&apos;header della sidebar e nel titolo della pagina.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="app-subtitle">Sottotitolo</FieldLabel>
          <Input
            id="app-subtitle"
            value={appSubtitle}
            onChange={(event) => setAppSubtitle(event.target.value)}
            placeholder="Dashboard"
            disabled={saving}
          />
          <FieldDescription>
            Riga piccola sotto il nome (modalità icona). Lascia vuoto per
            nasconderla.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Branding della sidebar</FieldLabel>
          <Tabs
            value={brandingMode}
            onValueChange={(value) => setBrandingMode(value as BrandingMode)}
          >
            <TabsList>
              <TabsTrigger value="icon">Icona + nome</TabsTrigger>
              <TabsTrigger value="logo">Logo personalizzato</TabsTrigger>
            </TabsList>

            <TabsContent value="icon" className="pt-3">
              <IconPicker
                value={iconName}
                onChange={setIconName}
                disabled={saving}
              />
            </TabsContent>

            <TabsContent value="logo" className="pt-3">
              <div className="flex flex-col gap-3">
                {logoFileId ? (
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/files/${logoFileId}`}
                      alt="Anteprima del logo"
                      className="h-16 w-auto max-w-48 rounded-md border bg-card object-contain p-2"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleLogoRemove}
                      disabled={uploading}
                    >
                      {uploading && <Spinner />}
                      Rimuovi logo
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading && <Spinner />}
                    Carica logo
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <FieldDescription>
                  PNG, JPEG, WebP, SVG o GIF, max 2 MB. Occupa la parte alta
                  della sidebar; quando è collassata torna l&apos;icona di
                  default. Ricorda di premere Salva per applicare la modalità.
                </FieldDescription>
              </div>
            </TabsContent>
          </Tabs>
        </Field>

        <Button type="submit" disabled={saving || !appName.trim()}>
          {saving && <Spinner />}
          Salva
        </Button>
      </FieldGroup>
    </form>
  )
}
