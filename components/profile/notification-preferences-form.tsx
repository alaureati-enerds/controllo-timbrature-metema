"use client"

import { useMemo, useState } from "react"
import { SaveIcon, ShieldIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"

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
  FieldSet,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  categoryLabel,
  defaultChannelsOf,
  notificationCatalog,
  type NotificationChannel,
  type NotificationEventDef,
} from "@/lib/notifications/catalog"
import type { UserPreferences } from "@/lib/settings/user"

// Preferenze di notifica PER-UTENTE: per ogni tipo, su quali canali riceverla
// (in app / email). Autorizzazione per ownership (PUT /api/me/preferences). Le
// notifiche OBBLIGATORIE hanno l'in-app sempre attivo e non disattivabile;
// l'email resta facoltativa per tutte. Vedi docs/notifiche.md.

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

// Canali effettivi iniziali di un tipo: la scelta salvata o, se assente, i
// default del catalogo. Per le obbligatorie l'in-app è sempre presente.
function initialChannels(
  ev: NotificationEventDef,
  saved: Record<string, NotificationChannel[]>
): Set<NotificationChannel> {
  const base = saved[ev.type] ?? defaultChannelsOf(ev.type)
  const set = new Set<NotificationChannel>(base)
  if (ev.mandatory) set.add("in-app")
  return set
}

export function NotificationPreferencesForm({
  initial,
}: {
  initial: UserPreferences
}) {
  const groups = useMemo(() => groupByCategory(), [])
  const [channels, setChannels] = useState<
    Record<string, Set<NotificationChannel>>
  >(() =>
    Object.fromEntries(
      notificationCatalog.map((ev) => [
        ev.type,
        initialChannels(ev, initial.notifications.channels),
      ])
    )
  )
  const [saving, setSaving] = useState(false)

  function toggle(type: string, channel: NotificationChannel, on: boolean) {
    setChannels((prev) => {
      const next = new Set(prev[type])
      if (on) next.add(channel)
      else next.delete(channel)
      return { ...prev, [type]: next }
    })
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        notifications: {
          channels: Object.fromEntries(
            Object.entries(channels).map(([type, set]) => [type, [...set]])
          ),
        },
      }
      const res = await fetch("/api/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const categoryIcons: Record<string, React.ReactNode> = {
    security: <ShieldIcon className="size-4" />,
    account: <UserIcon className="size-4" />,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifiche</CardTitle>
        <CardDescription>
          Scegli come ricevere ogni tipo di avviso. Le notifiche di sicurezza
          arrivano sempre in app; puoi aggiungere l&apos;email dove preferisci.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSave} className="contents">
        <CardContent>
          <FieldGroup>
            {groups.map((group) => (
              <FieldSet key={group.category}>
                <FieldLegend>
                  <span className="inline-flex items-center gap-1.5">
                    {categoryIcons[group.category]}
                    {categoryLabel(group.category)}
                  </span>
                </FieldLegend>
                <div className="flex flex-col divide-y divide-border">
                  {group.events.map((ev) => {
                    const set = channels[ev.type]
                    const inAppId = `ch-${ev.type}-in-app`
                    const emailId = `ch-${ev.type}-email`
                    return (
                      <Field key={ev.type} orientation="responsive" className="py-3 first:pt-0 last:pb-0">
                        <FieldContent>
                          <div className="flex items-start justify-between gap-2">
                            <FieldLabel>{ev.label}</FieldLabel>
                            {ev.mandatory && (
                              <Badge variant="secondary" className="shrink-0 mt-0.5">
                                Obbligatoria
                              </Badge>
                            )}
                          </div>
                          <FieldDescription>{ev.description}</FieldDescription>
                        </FieldContent>
                        <div className="flex items-center gap-5">
                          <div className="flex items-center gap-2">
                            <Switch
                              id={inAppId}
                              checked={set.has("in-app")}
                              disabled={ev.mandatory}
                              onCheckedChange={(c) =>
                                toggle(ev.type, "in-app", c)
                              }
                            />
                            <FieldLabel
                              htmlFor={inAppId}
                              className="text-xs font-normal text-muted-foreground"
                            >
                              In app
                            </FieldLabel>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={emailId}
                              checked={set.has("email")}
                              onCheckedChange={(c) =>
                                toggle(ev.type, "email", c)
                              }
                            />
                            <FieldLabel
                              htmlFor={emailId}
                              className="text-xs font-normal text-muted-foreground"
                            >
                              Email
                            </FieldLabel>
                          </div>
                        </div>
                      </Field>
                    )
                  })}
                </div>
              </FieldSet>
            ))}
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
