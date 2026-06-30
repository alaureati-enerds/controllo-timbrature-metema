"use client"

import { useMemo, useState } from "react"
import { ScrollTextIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  auditCatalog,
  categoryLabel,
  type AuditEventDef,
} from "@/lib/audit/catalog"
import type { AuditSettings } from "@/lib/settings/schema"

// Form di configurazione dell'audit log: interruttore generale, toggle per
// singolo evento (raggruppati per categoria dal catalogo) e giorni di
// retention. Salva via PUT /api/admin/audit/settings. La logica opt-out:
// `disabledActions` contiene gli eventi SPENTI, così uno nuovo è attivo di
// default. Vedi lib/audit/ e docs/audit-logging.md.

// Eventi del catalogo raggruppati per categoria, nell'ordine del catalogo.
function groupByCategory(): { category: string; events: AuditEventDef[] }[] {
  const groups: { category: string; events: AuditEventDef[] }[] = []
  for (const event of auditCatalog) {
    let group = groups.find((g) => g.category === event.category)
    if (!group) {
      group = { category: event.category, events: [] }
      groups.push(group)
    }
    group.events.push(event)
  }
  return groups
}

export function AuditSettingsForm({ initial }: { initial: AuditSettings }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [retentionDays, setRetentionDays] = useState(
    String(initial.retentionDays)
  )
  // Insieme degli eventi DISABILITATI (per `action`).
  const [disabled, setDisabled] = useState<Set<string>>(
    () => new Set(initial.disabledActions)
  )
  const [saving, setSaving] = useState(false)

  const groups = useMemo(() => groupByCategory(), [])

  function toggleEvent(action: string, on: boolean) {
    setDisabled((prev) => {
      const next = new Set(prev)
      if (on) next.delete(action)
      else next.add(action)
      return next
    })
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/audit/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          disabledActions: [...disabled],
          retentionDays: Number(retentionDays) || 0,
        }),
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
            <ScrollTextIcon aria-hidden="true" className="size-4" />
            Audit log
          </CardTitle>
          <CardDescription>
            Scegli quali eventi tracciare e per quanto conservarli. Le modifiche
            valgono dal salvataggio in poi.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <FieldGroup>
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor="audit-enabled">
                  Registrazione attiva
                </FieldLabel>
                <FieldDescription>
                  Interruttore generale: se spento, nessun evento viene
                  registrato.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="audit-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </Field>

            <FieldSeparator />

            <FieldSet>
              <FieldLegend>Conservazione</FieldLegend>
              <Field>
                <FieldLabel htmlFor="retention">
                  Giorni di retention
                </FieldLabel>
                <Input
                  id="retention"
                  name="retentionDays"
                  type="number"
                  min={0}
                  max={3650}
                  className="w-full tabular-nums md:w-40"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                />
                <FieldDescription>
                  Le righe più vecchie vengono eliminate dal worker (pulizia
                  giornaliera). 0 = conserva per sempre.
                </FieldDescription>
              </Field>
            </FieldSet>
          </FieldGroup>

          {/* Tanti eventi: la personalizzazione dei singoli toggle sta in un
              accordion chiuso di default. px-1 sul contenuto evita che il focus
              ring (3px) venga tagliato dall'overflow-hidden dell'accordion. */}
          <Accordion type="single" collapsible className="rounded-lg border px-4">
            <AccordionItem value="azioni" className="border-b-0">
              <AccordionTrigger>Azioni da tracciare</AccordionTrigger>
              <AccordionContent className="px-2">
                <FieldGroup>
                  {groups.map((group) => (
                    <FieldSet key={group.category} data-disabled={!enabled}>
                      <FieldLegend>
                        {categoryLabel(group.category)}
                      </FieldLegend>
                      <div className="grid gap-4 md:grid-cols-2">
                        {group.events.map((ev) => {
                          const on = !disabled.has(ev.action)
                          const id = `ev-${ev.action}`
                          return (
                            <Field key={ev.action} orientation="responsive">
                              <FieldContent>
                                <FieldLabel htmlFor={id}>
                                  {ev.label}
                                </FieldLabel>
                                <FieldDescription className="font-mono text-xs">
                                  {ev.action}
                                </FieldDescription>
                              </FieldContent>
                              <Switch
                                id={id}
                                checked={on}
                                disabled={!enabled}
                                onCheckedChange={(c) => toggleEvent(ev.action, c)}
                              />
                            </Field>
                          )
                        })}
                      </div>
                    </FieldSet>
                  ))}
                </FieldGroup>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner aria-hidden="true" /> : <SaveIcon data-icon="inline-start" aria-hidden="true" />}
            Salva
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
