"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ClockIcon, SaveIcon } from "lucide-react"
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
  FieldSeparator,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { OrarioLavoroSettingsAdmin } from "@/lib/settings/schema"

export function OrarioSettingsForm({
  initial,
}: {
  initial: OrarioLavoroSettingsAdmin
}) {
  const router = useRouter()

  const [primoIngresso, setPrimoIngresso] = useState(initial.primoIngresso)
  const [primaUscita, setPrimaUscita] = useState(initial.primaUscita)
  const [secondoIngresso, setSecondoIngresso] = useState(
    initial.secondoIngresso
  )
  const [secondaUscita, setSecondaUscita] = useState(initial.secondaUscita)
  const [saving, setSaving] = useState(false)

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/orario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primoIngresso,
          primaUscita,
          secondoIngresso,
          secondaUscita,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Operazione non riuscita")
      }
      toast.success("Orario di lavoro salvato")
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
          <CardTitle className="flex items-center gap-2">
            <ClockIcon aria-hidden="true" className="size-4" />
            Orario di lavoro standard
          </CardTitle>
          <CardDescription>
            Fasce orarie di riferimento per l&apos;assegnazione delle timbrature
            ai turni.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">Primo turno</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="orario-primo-ingresso">
                    Ingresso
                  </FieldLabel>
                  <Input
                    id="orario-primo-ingresso"
                    name="primoIngresso"
                    type="time"
                    value={primoIngresso}
                    onChange={(event) =>
                      setPrimoIngresso(event.target.value)
                    }
                    disabled={saving}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="orario-prima-uscita">
                    Uscita
                  </FieldLabel>
                  <Input
                    id="orario-prima-uscita"
                    name="primaUscita"
                    type="time"
                    value={primaUscita}
                    onChange={(event) => setPrimaUscita(event.target.value)}
                    disabled={saving}
                  />
                </Field>
              </div>
            </FieldSet>

            <FieldSeparator />

            <FieldSet>
              <FieldLegend variant="label">Secondo turno</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="orario-secondo-ingresso">
                    Ingresso
                  </FieldLabel>
                  <Input
                    id="orario-secondo-ingresso"
                    name="secondoIngresso"
                    type="time"
                    value={secondoIngresso}
                    onChange={(event) =>
                      setSecondoIngresso(event.target.value)
                    }
                    disabled={saving}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="orario-seconda-uscita">
                    Uscita
                  </FieldLabel>
                  <Input
                    id="orario-seconda-uscita"
                    name="secondaUscita"
                    type="time"
                    value={secondaUscita}
                    onChange={(event) => setSecondaUscita(event.target.value)}
                    disabled={saving}
                  />
                </Field>
              </div>
            </FieldSet>
          </FieldGroup>
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
