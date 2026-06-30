"use client"

import { useMemo, useState } from "react"
import { BellIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
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
  categoryLabel,
  notificationCatalog,
  type NotificationEventDef,
} from "@/lib/notifications/catalog"
import type { NotificationSettings } from "@/lib/settings/schema"

// Form di configurazione delle notifiche: interruttore generale, retention e
// toggle per singolo tipo (raggruppati per categoria dal catalogo). Salva via PUT
// /api/admin/settings/notifications. Logica opt-out come l'audit: `disabledTypes`
// contiene i tipi SPENTI, così uno nuovo è attivo di default. I tipi OBBLIGATORI
// (sicurezza) non sono disattivabili nemmeno dall'admin. Vedi docs/notifiche.md.

function groupByCategory(): {
  category: string
  events: NotificationEventDef[]
}[] {
  const groups: { category: string; events: NotificationEventDef[] }[] = []
  for (const event of notificationCatalog) {
    let group = groups.find((g) => g.category === event.category)
    if (!group) {
      group = { category: event.category, events: [] }
      groups.push(group)
    }
    group.events.push(event)
  }
  return groups
}

export function NotificationSettingsForm({
  initial,
}: {
  initial: NotificationSettings
}) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [retentionDays, setRetentionDays] = useState(
    String(initial.retentionDays)
  )
  const [disabled, setDisabled] = useState<Set<string>>(
    () => new Set(initial.disabledTypes)
  )
  const [saving, setSaving] = useState(false)

  const groups = useMemo(() => groupByCategory(), [])

  function toggleType(type: string, on: boolean) {
    setDisabled((prev) => {
      const next = new Set(prev)
      if (on) next.delete(type)
      else next.add(type)
      return next
    })
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          disabledTypes: [...disabled],
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
            <BellIcon aria-hidden="true" className="size-4" />
            Notifiche
          </CardTitle>
          <CardDescription>
            Scegli quali azioni generano una notifica e per quanto conservare le
            notifiche lette. Le modifiche valgono dal salvataggio in poi.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <FieldGroup>
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor="notif-enabled">
                  Notifiche attive
                </FieldLabel>
                <FieldDescription>
                  Interruttore generale. Se spento, non viene creata alcuna
                  notifica, tranne quelle obbligatorie di sicurezza.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="notif-enabled"
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
                  Le notifiche già lette più vecchie vengono eliminate dalla
                  pulizia giornaliera del worker. Le non lette non scadono mai. 0
                  = conserva per sempre.
                </FieldDescription>
              </Field>
            </FieldSet>
          </FieldGroup>

          {/* px-1 sul contenuto evita che il focus ring (3px) venga tagliato
              dall'overflow-hidden dell'accordion. */}
          <Accordion type="single" collapsible className="rounded-lg border px-4">
            <AccordionItem value="tipi" className="border-b-0">
              <AccordionTrigger>Azioni che generano notifiche</AccordionTrigger>
              <AccordionContent className="px-1">
                <FieldGroup>
                  {groups.map((group) => (
                    <FieldSet key={group.category} data-disabled={!enabled}>
                      <FieldLegend>
                        {categoryLabel(group.category)}
                      </FieldLegend>
                      <div className="grid gap-4 md:grid-cols-2">
                        {group.events.map((ev) => {
                          // Le obbligatorie sono sempre attive e non spegnibili.
                          const on = ev.mandatory || !disabled.has(ev.type)
                          const id = `nt-${ev.type}`
                          return (
                            <Field key={ev.type} orientation="responsive">
                              <FieldContent>
                                <FieldLabel htmlFor={id}>
                                  {ev.label}
                                  {ev.mandatory && (
                                    <Badge
                                      variant="secondary"
                                      className="ml-2"
                                    >
                                      Obbligatoria
                                    </Badge>
                                  )}
                                </FieldLabel>
                                <FieldDescription>
                                  {ev.description}
                                </FieldDescription>
                              </FieldContent>
                              <Switch
                                id={id}
                                checked={on}
                                disabled={!enabled || ev.mandatory}
                                onCheckedChange={(c) => toggleType(ev.type, c)}
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
