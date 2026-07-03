"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { PencilIcon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ORARIO_REGEX, mascheraOrario } from "@/lib/timbrature/ora"

type Preset = {
  id: string
  nome: string
  entrata1: string | null
  uscita1: string | null
  entrata2: string | null
  uscita2: string | null
}

type Standard = {
  entrata1: string
  uscita1: string
  entrata2: string
  uscita2: string
}

function formattaTurno(entrata: string | null, uscita: string | null): string {
  if (!entrata && !uscita) return "—"
  return `${entrata ?? "—"} – ${uscita ?? "—"}`
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  return data?.error ?? "Operazione non riuscita"
}

export function OrariLavoroManager({ standard }: { standard: Standard }) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const carica = useCallback(() => {
    fetch("/api/admin/presets")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data: Preset[]) => setPresets(data))
      .catch(() => toast.error("Impossibile caricare i preset"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    carica()
  }, [carica])

  async function elimina(preset: Preset) {
    setBusyId(preset.id)
    try {
      const res = await fetch(`/api/admin/presets/${preset.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error(await readError(res))
      toast.success(`Preset "${preset.nome}" eliminato`)
      carica()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setBusyId(null)
    }
  }

  const rowActions = (preset: Preset) => (
    <div className="flex items-center justify-end gap-1">
      <PresetDialog preset={preset} onSaved={carica} tooltip="Modifica">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Modifica ${preset.nome}`}
        >
          <PencilIcon />
        </Button>
      </PresetDialog>
      <AlertDialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Elimina ${preset.nome}`}
                disabled={busyId === preset.id}
              >
                {busyId === preset.id ? <Spinner /> : <Trash2Icon />}
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Elimina</TooltipContent>
        </Tooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare «{preset.nome}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Il preset verrà eliminato in modo permanente. Le correzioni già
              applicate alle timbrature non vengono toccate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => elimina(preset)}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )

  const standardAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Modifica nelle Impostazioni di sistema"
          asChild
        >
          <Link href="/admin/settings">
            <SettingsIcon />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Modifica in Impostazioni</TooltipContent>
    </Tooltip>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preset di orario</CardTitle>
        <CardDescription>
          Orari riutilizzabili da applicare alle correzioni. L&apos;Orario
          Standard si modifica nelle Impostazioni di sistema.
        </CardDescription>
        <CardAction>
          <PresetDialog onSaved={carica}>
            <Button size="sm">
              <PlusIcon data-icon="inline-start" />
              Nuovo preset
            </Button>
          </PresetDialog>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0 sm:px-6 sm:pb-6">
        {loading ? (
          <div className="flex flex-col gap-2 px-6 pb-6 sm:px-0 sm:pb-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Desktop: tabella */}
            <div className="hidden md:block">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Primo turno</TableHead>
                      <TableHead>Secondo turno</TableHead>
                      <TableHead className="w-24 text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          Orario Standard
                          <Badge variant="secondary">Standard</Badge>
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formattaTurno(standard.entrata1, standard.uscita1)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formattaTurno(standard.entrata2, standard.uscita2)}
                      </TableCell>
                      <TableCell className="text-right">{standardAction}</TableCell>
                    </TableRow>
                    {presets.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell className="tabular-nums">
                          {formattaTurno(p.entrata1, p.uscita1)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formattaTurno(p.entrata2, p.uscita2)}
                        </TableCell>
                        <TableCell>{rowActions(p)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile: card list */}
            <div className="flex flex-col gap-3 px-4 pb-4 md:hidden">
              <Card size="sm" className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      Orario Standard
                      <Badge variant="secondary">Standard</Badge>
                    </span>
                    {standardAction}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
                    <span>1° turno: {formattaTurno(standard.entrata1, standard.uscita1)}</span>
                    <span>2° turno: {formattaTurno(standard.entrata2, standard.uscita2)}</span>
                  </div>
                </CardContent>
              </Card>
              {presets.map((p) => (
                <Card key={p.id} size="sm">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-medium">{p.nome}</span>
                      {rowActions(p)}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
                      <span>1° turno: {formattaTurno(p.entrata1, p.uscita1)}</span>
                      <span>2° turno: {formattaTurno(p.entrata2, p.uscita2)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {presets.length === 0 && (
              <p className="px-6 py-4 text-center text-sm text-muted-foreground">
                Nessun preset personalizzato. Creane uno con{" "}
                <strong>Nuovo preset</strong>.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Dialog di creazione/modifica preset. Senza `preset` è in modalità creazione.
// Con `tooltip` avvolge il trigger in un Tooltip (per il bottone solo-icona).
function PresetDialog({
  preset,
  onSaved,
  tooltip,
  children,
}: {
  preset?: Preset
  onSaved: () => void
  tooltip?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nome, setNome] = useState(preset?.nome ?? "")
  const [entrata1, setEntrata1] = useState(preset?.entrata1 ?? "")
  const [uscita1, setUscita1] = useState(preset?.uscita1 ?? "")
  const [entrata2, setEntrata2] = useState(preset?.entrata2 ?? "")
  const [uscita2, setUscita2] = useState(preset?.uscita2 ?? "")

  // All'apertura ricarica i valori (in modifica) o li azzera (in creazione).
  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setNome(preset?.nome ?? "")
      setEntrata1(preset?.entrata1 ?? "")
      setUscita1(preset?.uscita1 ?? "")
      setEntrata2(preset?.entrata2 ?? "")
      setUscita2(preset?.uscita2 ?? "")
    }
  }

  // Validazione client (rete di sicurezza; la fonte di verità è il server).
  function validate(): string | null {
    if (!nome.trim()) return "Il nome è obbligatorio"
    for (const [v, label] of [
      [entrata1, "Entrata primo turno"],
      [uscita1, "Uscita primo turno"],
      [entrata2, "Entrata secondo turno"],
      [uscita2, "Uscita secondo turno"],
    ] as const) {
      if (v && !ORARIO_REGEX.test(v)) return `${label}: formato orario non valido`
    }
    if (!!entrata1 !== !!uscita1) return "Il primo turno richiede entrata e uscita"
    if (!!entrata2 !== !!uscita2) return "Il secondo turno richiede entrata e uscita"
    if (!entrata1 && !uscita1 && !entrata2 && !uscita2)
      return "Compila almeno un turno"
    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errore = validate()
    if (errore) {
      toast.error(errore)
      return
    }
    setSaving(true)
    try {
      const body = {
        nome: nome.trim(),
        entrata1: entrata1 || null,
        uscita1: uscita1 || null,
        entrata2: entrata2 || null,
        uscita2: uscita2 || null,
      }
      const res = await fetch(
        preset ? `/api/admin/presets/${preset.id}` : "/api/admin/presets",
        {
          method: preset ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) throw new Error(await readError(res))
      toast.success(preset ? "Preset aggiornato" : "Preset creato")
      setOpen(false)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setSaving(false)
    }
  }

  const trigger = tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <DialogTrigger asChild>{children}</DialogTrigger>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  ) : (
    <DialogTrigger asChild>{children}</DialogTrigger>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {preset ? "Modifica preset" : "Nuovo preset"}
            </DialogTitle>
            <DialogDescription>
              Lascia vuoto un turno se non serve. Gli orari sono nel formato
              HH:MM.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="preset-nome">Nome</FieldLabel>
              <Input
                id="preset-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Turno unico"
                autoComplete="off"
                disabled={saving}
              />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Primo turno</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <OraField
                  id="preset-entrata1"
                  label="Entrata"
                  value={entrata1}
                  onChange={setEntrata1}
                  disabled={saving}
                />
                <OraField
                  id="preset-uscita1"
                  label="Uscita"
                  value={uscita1}
                  onChange={setUscita1}
                  disabled={saving}
                />
              </div>
            </FieldSet>
            <FieldSeparator />
            <FieldSet>
              <FieldLegend variant="label">Secondo turno</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <OraField
                  id="preset-entrata2"
                  label="Entrata"
                  value={entrata2}
                  onChange={setEntrata2}
                  disabled={saving}
                />
                <OraField
                  id="preset-uscita2"
                  label="Uscita"
                  value={uscita2}
                  onChange={setUscita2}
                  disabled={saving}
                />
              </div>
            </FieldSet>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Annulla
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Spinner aria-hidden="true" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              {preset ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function OraField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        inputMode="numeric"
        placeholder="HH:MM"
        className="tabular-nums"
        onChange={(e) => onChange(mascheraOrario(e.target.value))}
        disabled={disabled}
      />
    </Field>
  )
}
