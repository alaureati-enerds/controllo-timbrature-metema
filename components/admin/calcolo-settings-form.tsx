"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalculatorIcon, SaveIcon } from "lucide-react"
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
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
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
import { Switch } from "@/components/ui/switch"
import type { CalcoloSettingsAdmin } from "@/lib/settings/schema"

// Form delle regole del motore di calcolo delle timbrature. Salva via
// PUT /api/admin/settings/calcolo. Larghezza piena, campi raggruppati per fase
// della pipeline (pulizia → turni → arrotondamento → completamento →
// straordinario). Vedi docs/calcolo-timbrature.md per il perché di ogni regola.

type Verso = CalcoloSettingsAdmin["versoEntrata"]

export function CalcoloSettingsForm({
  initial,
}: {
  initial: CalcoloSettingsAdmin
}) {
  const router = useRouter()

  const [ignora0000, setIgnora0000] = useState(initial.ignora0000)
  const [dedupMinuti, setDedupMinuti] = useState(String(initial.dedupMinuti))
  const [sogliaPomeriggio, setSogliaPomeriggio] = useState(
    initial.sogliaPomeriggio
  )
  const [strategiaUscita, setStrategiaUscita] = useState(initial.strategiaUscita)
  const [granularitaMinuti, setGranularitaMinuti] = useState(
    String(initial.granularitaMinuti)
  )
  const [versoEntrata, setVersoEntrata] = useState<Verso>(initial.versoEntrata)
  const [versoUscita, setVersoUscita] = useState<Verso>(initial.versoUscita)
  const [pausaAutomatica, setPausaAutomatica] = useState(initial.pausaAutomatica)
  const [pausaSpanMinimo, setPausaSpanMinimo] = useState(
    String(initial.pausaSpanMinimo)
  )
  const [minutiOrdinari, setMinutiOrdinari] = useState(
    String(initial.minutiOrdinari)
  )
  const [oreMassimeGiorno, setOreMassimeGiorno] = useState(
    String(initial.oreMassimeGiorno)
  )
  const [saving, setSaving] = useState(false)

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/calcolo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ignora0000,
          dedupMinuti: Number(dedupMinuti),
          sogliaPomeriggio,
          strategiaUscita,
          granularitaMinuti: Number(granularitaMinuti),
          versoEntrata,
          versoUscita,
          pausaAutomatica,
          pausaSpanMinimo: Number(pausaSpanMinimo),
          minutiOrdinari: Number(minutiOrdinari),
          oreMassimeGiorno: Number(oreMassimeGiorno),
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Operazione non riuscita")
      }
      toast.success("Regole di calcolo salvate")
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
            <CalculatorIcon aria-hidden="true" className="size-4" />
            Regole di calcolo
          </CardTitle>
          <CardDescription>
            Come le timbrature grezze diventano ore lavorate: pulizia dei dati,
            assegnazione dei turni, arrotondamenti e ricostruzione della pausa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">Pulizia dei dati</FieldLegend>
              <Field orientation="responsive">
                <FieldContent>
                  <FieldLabel htmlFor="calcolo-ignora0000">
                    Ignora le timbrature 00:00
                  </FieldLabel>
                  <FieldDescription>
                    Scarta il valore sentinella del marcatempo prima di calcolare.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="calcolo-ignora0000"
                  checked={ignora0000}
                  onCheckedChange={setIgnora0000}
                  disabled={saving}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="calcolo-dedup">
                  Unifica i doppioni entro (minuti)
                </FieldLabel>
                <Input
                  id="calcolo-dedup"
                  name="dedupMinuti"
                  type="number"
                  min={0}
                  className="w-full tabular-nums md:w-40"
                  value={dedupMinuti}
                  onChange={(e) => setDedupMinuti(e.target.value)}
                  disabled={saving}
                />
                <FieldDescription>
                  Collassa due timbri dello stesso tipo ravvicinati (tiene la
                  prima entrata, l&apos;ultima uscita). 0 = disattivato.
                </FieldDescription>
              </Field>
            </FieldSet>

            <FieldSeparator />

            <FieldSet>
              <FieldLegend variant="label">Turni</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="calcolo-soglia">
                    Soglia mattino / pomeriggio
                  </FieldLabel>
                  <Input
                    id="calcolo-soglia"
                    name="sogliaPomeriggio"
                    type="time"
                    value={sogliaPomeriggio}
                    onChange={(e) => setSogliaPomeriggio(e.target.value)}
                    disabled={saving}
                  />
                  <FieldDescription>
                    Orario che separa il primo turno dal secondo.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="calcolo-strategia">
                    Uscita del turno
                  </FieldLabel>
                  <Select
                    value={strategiaUscita}
                    onValueChange={(v) =>
                      setStrategiaUscita(v as CalcoloSettingsAdmin["strategiaUscita"])
                    }
                    disabled={saving}
                  >
                    <SelectTrigger id="calcolo-strategia" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ultima">Ultima uscita</SelectItem>
                      <SelectItem value="prima">Prima uscita</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Quale uscita chiude il turno con timbri multipli.
                  </FieldDescription>
                </Field>
              </div>
            </FieldSet>

            <FieldSeparator />

            <FieldSet>
              <FieldLegend variant="label">Arrotondamento</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="calcolo-granularita">
                    Granularità (minuti)
                  </FieldLabel>
                  <Input
                    id="calcolo-granularita"
                    name="granularitaMinuti"
                    type="number"
                    min={1}
                    className="w-full tabular-nums"
                    value={granularitaMinuti}
                    onChange={(e) => setGranularitaMinuti(e.target.value)}
                    disabled={saving}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="calcolo-verso-entrata">Entrate</FieldLabel>
                  <Select
                    value={versoEntrata}
                    onValueChange={(v) => setVersoEntrata(v as Verso)}
                    disabled={saving}
                  >
                    <SelectTrigger id="calcolo-verso-entrata" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="su">Per eccesso</SelectItem>
                      <SelectItem value="giu">Per difetto</SelectItem>
                      <SelectItem value="vicino">Al più vicino</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="calcolo-verso-uscita">Uscite</FieldLabel>
                  <Select
                    value={versoUscita}
                    onValueChange={(v) => setVersoUscita(v as Verso)}
                    disabled={saving}
                  >
                    <SelectTrigger id="calcolo-verso-uscita" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="su">Per eccesso</SelectItem>
                      <SelectItem value="giu">Per difetto</SelectItem>
                      <SelectItem value="vicino">Al più vicino</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <FieldDescription>
                Per tradizione le entrate si arrotondano per eccesso, le uscite
                per difetto.
              </FieldDescription>
            </FieldSet>

            <FieldSeparator />

            <FieldSet>
              <FieldLegend variant="label">
                Completamento della pausa
              </FieldLegend>
              <Field orientation="responsive">
                <FieldContent>
                  <FieldLabel htmlFor="calcolo-pausa">
                    Ricostruisci la pausa pranzo
                  </FieldLabel>
                  <FieldDescription>
                    Solo su giornata chiusa ai due estremi (entrata mattutina e
                    uscita serale): mai inventare entrata o uscita.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="calcolo-pausa"
                  checked={pausaAutomatica}
                  onCheckedChange={setPausaAutomatica}
                  disabled={saving}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="calcolo-span">
                  Span minimo per ricostruire (minuti)
                </FieldLabel>
                <Input
                  id="calcolo-span"
                  name="pausaSpanMinimo"
                  type="number"
                  min={0}
                  className="w-full tabular-nums md:w-40"
                  value={pausaSpanMinimo}
                  onChange={(e) => setPausaSpanMinimo(e.target.value)}
                  disabled={saving}
                />
                <FieldDescription>
                  Sotto questa distanza fra entrata e uscita la pausa non viene
                  ricostruita (resta una mezza giornata).
                </FieldDescription>
              </Field>
            </FieldSet>

            <FieldSeparator />

            <FieldSet>
              <FieldLegend variant="label">Straordinario</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="calcolo-ordinari">
                    Minuti ordinari al giorno
                  </FieldLabel>
                  <Input
                    id="calcolo-ordinari"
                    name="minutiOrdinari"
                    type="number"
                    min={0}
                    className="w-full tabular-nums"
                    value={minutiOrdinari}
                    onChange={(e) => setMinutiOrdinari(e.target.value)}
                    disabled={saving}
                  />
                  <FieldDescription>
                    Oltre questa soglia le ore diventano straordinario (480 = 8h).
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="calcolo-max">
                    Durata massima giornaliera (minuti)
                  </FieldLabel>
                  <Input
                    id="calcolo-max"
                    name="oreMassimeGiorno"
                    type="number"
                    min={0}
                    className="w-full tabular-nums"
                    value={oreMassimeGiorno}
                    onChange={(e) => setOreMassimeGiorno(e.target.value)}
                    disabled={saving}
                  />
                  <FieldDescription>
                    Oltre questa durata il giorno è segnalato come anomalo
                    (720 = 12h).
                  </FieldDescription>
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
