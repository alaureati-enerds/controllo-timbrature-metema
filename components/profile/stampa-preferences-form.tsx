"use client"

import { useState } from "react"
import { SaveIcon } from "lucide-react"
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  getStampaTemplate,
  stampaTemplates,
  type StampaTemplateId,
} from "@/lib/timbrature/stampa/catalog"
import type { UserPreferences } from "@/lib/settings/user"

// Preferenza PER-UTENTE: il template di stampa proposto di default nel dialog
// del registro presenze. Autorizzazione per ownership (PUT /api/me/preferences).
// Vedi docs/stampa-timbrature.md e docs/impostazioni-di-sistema.md.

export function StampaPreferencesForm({
  initial,
}: {
  initial: UserPreferences
}) {
  const [templateId, setTemplateId] = useState<StampaTemplateId>(
    initial.stampa.templateId
  )
  const [saving, setSaving] = useState(false)

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stampa: { templateId } }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Operazione non riuscita")
      }
      toast.success("Preferenze salvate")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stampa</CardTitle>
        <CardDescription>
          Il template proposto di default quando stampi il registro presenze.
          Puoi comunque cambiarlo al momento della stampa.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSave} className="contents">
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pref-stampa-template">
                Template predefinito
              </FieldLabel>
              <Select
                value={templateId}
                onValueChange={(v) => setTemplateId(v as StampaTemplateId)}
              >
                <SelectTrigger id="pref-stampa-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stampaTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {getStampaTemplate(templateId).descrizione}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner /> : <SaveIcon data-icon="inline-start" />}
            Salva preferenze
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
