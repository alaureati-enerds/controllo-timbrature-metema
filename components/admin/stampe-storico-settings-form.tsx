"use client"

import { useState } from "react"
import { HistoryIcon, SaveIcon } from "lucide-react"
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
import { Field, FieldDescription, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { StampeSettings } from "@/lib/settings/schema"

// Form di configurazione dello storico stampe: solo la retention (a
// differenza dell'audit log, il salvataggio non ha un interruttore né toggle
// per evento, vedi lib/settings/schema.ts). Salva via PUT
// /api/admin/timbrature/stampe/settings. Gemello minimale di
// AuditSettingsForm.

export function StampeStoricoSettingsForm({
  initial,
}: {
  initial: StampeSettings
}) {
  const [retentionDays, setRetentionDays] = useState(
    String(initial.retentionDays)
  )
  const [saving, setSaving] = useState(false)

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/timbrature/stampe/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays: Number(retentionDays) || 0 }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Operazione non riuscita")
      }
      toast.success("Configurazione salvata")
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
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon aria-hidden="true" className="size-4" />
            Storico stampe
          </CardTitle>
          <CardDescription>
            Per quanto conservare i PDF del registro presenze già generati
            (vedi Timbrature → Storico stampe).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldSet>
            <Field>
              <FieldLabel htmlFor="stampe-retention">
                Giorni di retention
              </FieldLabel>
              <Input
                id="stampe-retention"
                name="retentionDays"
                type="number"
                min={0}
                max={3650}
                className="w-full tabular-nums md:w-40"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
              />
              <FieldDescription>
                I PDF più vecchi vengono eliminati dal worker (pulizia
                giornaliera). 0 = conserva per sempre.
              </FieldDescription>
            </Field>
          </FieldSet>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Spinner aria-hidden="true" />
            ) : (
              <SaveIcon data-icon="inline-start" aria-hidden="true" />
            )}
            Salva
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
