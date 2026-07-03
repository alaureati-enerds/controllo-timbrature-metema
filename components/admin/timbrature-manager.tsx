"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCwIcon,
  SearchIcon,
} from "lucide-react"
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
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

import type { Dipendente } from "@/lib/mysql/timbrature"
import { arrotondaEntrata, arrotondaUscita } from "@/lib/timbrature/arrotondamento"
import { ORARIO_REGEX, mascheraOrario } from "@/lib/timbrature/ora"
import type { Giornata } from "@/app/api/admin/timbrature/route"

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
]

// Un preset di orario applicabile: quelli personalizzati vengono dall'API,
// l'Orario Standard è derivato dalle impostazioni di sistema (stato `orario`).
type Preset = {
  id: string
  nome: string
  entrata1: string | null
  uscita1: string | null
  entrata2: string | null
  uscita2: string | null
}

const STANDARD_ID = "__standard__"

// Riga di correzione come arriva dall'API (i turni non corretti sono null).
type CorrezioneRaw = {
  giorno: string
  entrata1?: string | null
  uscita1?: string | null
  entrata2?: string | null
  uscita2?: string | null
}

function meseCorrente() {
  const oggi = new Date()
  return {
    mese: oggi.getDate() <= 15
      ? (oggi.getMonth() === 0 ? 11 : oggi.getMonth() - 1)
      : oggi.getMonth(),
    anno: oggi.getDate() <= 15 && oggi.getMonth() === 0
      ? oggi.getFullYear() - 1
      : oggi.getFullYear(),
  }
}

function formattaMinuti(minuti: number): string {
  if (minuti === 0) return "—"
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${h}h ${m}m`
}

function minutiDaOra(ora: string): number {
  const [h, m] = ora.split(":").map(Number)
  return h * 60 + m
}

function calcolaCorretti(
  g: Giornata,
  override?: Record<string, string | null>
) {
  const ce1 = override?.entrata1 ?? (g.entrata1 ? arrotondaEntrata(g.entrata1) : null)
  const cu1 = override?.uscita1 ?? (g.uscita1 ? arrotondaUscita(g.uscita1) : null)
  const ce2 = override?.entrata2 ?? (g.entrata2 ? arrotondaEntrata(g.entrata2) : null)
  const cu2 = override?.uscita2 ?? (g.uscita2 ? arrotondaUscita(g.uscita2) : null)

  const minuti = (ce1 && cu1 ? minutiDaOra(cu1) - minutiDaOra(ce1) : 0)
    + (ce2 && cu2 ? minutiDaOra(cu2) - minutiDaOra(ce2) : 0)

  return {
    ce1, cu1, ce2, cu2,
    totale: minuti,
    ordinario: Math.min(minuti, 480),
    straordinario: Math.max(minuti - 480, 0),
  }
}

function CorrettaCell({
  giorno,
  campo,
  valore,
  editing,
  setEditing,
  editRef,
  onSave,
}: {
  giorno: string
  campo: string
  valore: string | null
  editing: { giorno: string; campo: string } | null
  setEditing: (k: { giorno: string; campo: string } | null) => void
  editRef: React.RefObject<HTMLInputElement | null>
  onSave: (giorno: string, campo: string, v: string | null) => void
}) {
  const isEditing = editing?.giorno === giorno && editing?.campo === campo
  const [invalid, setInvalid] = useState(false)
  const [draft, setDraft] = useState(valore ?? "")

  function startEdit() {
    setInvalid(false)
    setDraft(valore ?? "")
    setEditing({ giorno, campo })
    requestAnimationFrame(() => editRef.current?.select())
  }

  function commit() {
    const v = draft.trim()
    if (!v || v === valore) {
      setEditing(null)
      return
    }
    if (!ORARIO_REGEX.test(v)) {
      setInvalid(true)
      toast.error("Formato orario non valido: usa HH:MM (es. 08:30)")
      editRef.current?.focus()
      return
    }
    setEditing(null)
    onSave(giorno, campo, v)
  }

  function onChangeDraft(e: React.ChangeEvent<HTMLInputElement>) {
    setInvalid(false)
    setDraft(mascheraOrario(e.target.value))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit()
    if (e.key === "Escape") setEditing(null)
  }

  function onCellKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      startEdit()
    }
  }

  if (isEditing) {
    return (
      <TableCell className="p-1 text-center">
        <Input
          ref={editRef}
          value={draft}
          inputMode="numeric"
          placeholder="HH:MM"
          aria-invalid={invalid}
          className="h-8 px-2 text-center tabular-nums text-sky-600"
          onBlur={commit}
          onKeyDown={onKeyDown}
          onChange={onChangeDraft}
        />
      </TableCell>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TableCell
          role="button"
          tabIndex={0}
          className="cursor-pointer text-center tabular-nums text-sky-600 outline-none hover:bg-muted/20 focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={startEdit}
          onKeyDown={onCellKeyDown}
        >
          {valore ?? "—"}
        </TableCell>
      </TooltipTrigger>
      <TooltipContent>Clicca per modificare</TooltipContent>
    </Tooltip>
  )
}

export function TimbratureManager() {
  const def = meseCorrente()
  const [mese, setMese] = useState(def.mese)
  const [anno, setAnno] = useState(def.anno)
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([])
  const [dipendente, setDipendente] = useState<Dipendente | null>(null)
  const [giornate, setGiornate] = useState<Giornata[]>([])
  const [orario, setOrario] = useState({
    primoIngresso: "08:00",
    primaUscita: "12:00",
    secondoIngresso: "13:30",
    secondaUscita: "17:30",
  })
  const [loading, setLoading] = useState(false)
  const [loadingDip, setLoadingDip] = useState(true)
  const [correzioni, setCorrezioni] = useState<Map<string, Record<string, string | null>>>(new Map())
  const [applyingPreset, setApplyingPreset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [presets, setPresets] = useState<Preset[]>([])

  type EditingKey = { giorno: string; campo: string }
  const [editing, setEditing] = useState<EditingKey | null>(null)
  const editRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggleSelect(giorno: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(giorno)) next.delete(giorno)
      else next.add(giorno)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === righe.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(righe.map((r) => r.giorno)))
    }
  }

  // Preset applicabili: l'Orario Standard (dalle impostazioni di sistema, così
  // resta allineato) seguito dai preset personalizzati.
  const presetsApplicabili = useMemo<Preset[]>(
    () => [
      {
        id: STANDARD_ID,
        nome: "Orario Standard",
        entrata1: orario.primoIngresso,
        uscita1: orario.primaUscita,
        entrata2: orario.secondoIngresso,
        uscita2: orario.secondaUscita,
      },
      ...presets,
    ],
    [orario, presets]
  )

  // Applica un preset alle giornate selezionate. I campi valorizzati del preset
  // diventano la correzione del giorno; i turni vuoti vengono azzerati sul
  // server (null) e ricadono sul calcolo dal dato reale.
  async function applicaPreset(id: string) {
    if (!dipendente || selected.size === 0) return
    const preset = presetsApplicabili.find((p) => p.id === id)
    if (!preset) return
    const campi = {
      entrata1: preset.entrata1 || null,
      uscita1: preset.uscita1 || null,
      entrata2: preset.entrata2 || null,
      uscita2: preset.uscita2 || null,
    }

    setApplyingPreset(true)
    try {
      await Promise.all(
        Array.from(selected).map((giorno) =>
          fetch("/api/admin/timbrature/correzioni", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dipendente: dipendente.codice,
              giorno,
              ...campi,
            }),
          }).then((r) => {
            if (!r.ok) throw new Error()
          })
        )
      )
      // Nello stato locale teniamo solo i campi valorizzati (come al reload),
      // così i turni vuoti tornano a mostrare il dato reale calcolato.
      const soloValorizzati = Object.fromEntries(
        Object.entries(campi).filter(([, v]) => v !== null)
      ) as Record<string, string>
      setCorrezioni((prev) => {
        const next = new Map(prev)
        for (const giorno of selected) next.set(giorno, soloValorizzati)
        return next
      })
      toast.success(`Preset «${preset.nome}» applicato a ${selected.size} giornata/e`)
      setSelected(new Set())
    } catch {
      toast.error("Errore applicazione preset")
    } finally {
      setApplyingPreset(false)
    }
  }

  async function salvaCorrezione(
    giorno: string,
    campo: string,
    valore: string | null
  ) {
    if (!dipendente) return
    const prev = correzioni.get(giorno) ?? {}
    const next = { ...prev, [campo]: valore }

    try {
      const res = await fetch("/api/admin/timbrature/correzioni", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dipendente: dipendente.codice,
          giorno,
          ...next,
        }),
      })
      if (!res.ok) throw new Error()
      setCorrezioni(new Map(correzioni).set(giorno, next))
    } catch {
      toast.error("Errore salvataggio correzione")
    }
  }

  async function resettaTutto() {
    if (!dipendente || correzioni.size === 0) return
    setResetting(true)
    try {
      const res = await fetch(
        `/api/admin/timbrature/correzioni?dipendente=${dipendente.codice}&mese=${mese + 1}&anno=${anno}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error()
      setCorrezioni(new Map())
      toast.success("Correzioni azzerate")
    } catch {
      toast.error("Errore reset correzioni")
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    fetch("/api/admin/presets")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPresets(data as Preset[]))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch("/api/admin/timbrature/dipendenti")
      .then((res) => res.json())
      .then((data) => {
        setDipendenti(data as Dipendente[])
        setLoadingDip(false)
      })
      .catch(() => {
        toast.error("Impossibile caricare i dipendenti")
        setLoadingDip(false)
      })
  }, [])

  const carica = useCallback(() => {
    if (!dipendente) return
    setLoading(true)
    setCorrezioni(new Map())
    setSelected(new Set())
    const params = new URLSearchParams({
      dipendente: dipendente.codice,
      mese: String(mese + 1),
      anno: String(anno),
    })
    Promise.all([
      fetch(`/api/admin/timbrature?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      }),
      fetch(`/api/admin/timbrature/correzioni?${params.toString()}`)
        .then((r) => r.json())
        .catch(() => []),
    ])
      .then(
        ([data, correzioniRaw]: [
          { giornate: Giornata[]; orario: typeof orario },
          CorrezioneRaw[],
        ]) => {
          setGiornate(data.giornate)
          setOrario(data.orario)
          setCorrezioni(
            new Map(
              correzioniRaw.map(
                (c) => [
                  c.giorno,
                  {
                    ...(c.entrata1 !== null && { entrata1: c.entrata1 }),
                    ...(c.uscita1 !== null && { uscita1: c.uscita1 }),
                    ...(c.entrata2 !== null && { entrata2: c.entrata2 }),
                    ...(c.uscita2 !== null && { uscita2: c.uscita2 }),
                  },
                ]
              )
            )
          )
          setLoading(false)
        }
      )
      .catch(() => {
        toast.error("Impossibile caricare le timbrature")
        setLoading(false)
      })
  }, [dipendente, mese, anno])

  const meseLabel = `${MESI[mese]} ${anno}`

  function meseSu() {
    if (mese === 11) { setMese(0); setAnno((a) => a + 1) }
    else setMese((m) => m + 1)
  }
  function meseGiu() {
    if (mese === 0) { setMese(11); setAnno((a) => a - 1) }
    else setMese((m) => m - 1)
  }

  const weekEnd = (g: string) => {
    const d = new Date(g + "T12:00:00")
    return d.getDay() === 0 || d.getDay() === 6
  }

  const righe = useMemo(
    () =>
      giornate.map((g) => ({
        ...g,
        ...calcolaCorretti(g, correzioni.get(g.giorno)),
        we: weekEnd(g.giorno),
      })),
    [giornate, correzioni]
  )

  const totaliMese = useMemo(
    () => ({
      totale: righe.reduce((s, r) => s + r.totale, 0),
      ordinario: righe.reduce((s, r) => s + r.ordinario, 0),
      straordinario: righe.reduce((s, r) => s + r.straordinario, 0),
    }),
    [righe]
  )

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium">
                Dipendente
              </label>
              <Combobox
                items={dipendenti}
                value={dipendente}
                onValueChange={setDipendente}
              >
                <ComboboxTrigger
                  render={
                    <Button
                      variant="outline"
                      className="w-full justify-between font-normal"
                      disabled={loadingDip}
                    />
                  }
                >
                  {dipendente
                    ? dipendente.descrizione || dipendente.codice
                    : loadingDip
                      ? "Caricamento..."
                      : "Seleziona dipendente"}
                </ComboboxTrigger>
                <ComboboxContent>
                  <ComboboxInput showTrigger={false} placeholder="Cerca dipendente..." />
                  <ComboboxEmpty>Nessun dipendente trovato.</ComboboxEmpty>
                  <ComboboxList>
                    {(d) => (
                      <ComboboxItem key={d.codice} value={d}>
                        {d.descrizione || d.codice}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            <div className="flex items-end gap-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Periodo
                </label>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Mese precedente"
                        onClick={meseGiu}
                      >
                        <ChevronLeftIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mese precedente</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="outline"
                    className="min-w-0 flex-1 justify-start font-normal tabular-nums sm:w-40 sm:flex-none"
                    disabled
                  >
                    <CalendarIcon data-icon="inline-start" />
                    {meseLabel}
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Mese successivo"
                        onClick={meseSu}
                      >
                        <ChevronRightIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mese successivo</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <Button onClick={carica} disabled={!dipendente || loading}>
                {loading ? <Spinner aria-hidden="true" /> : <SearchIcon data-icon="inline-start" />}
                Carica
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {dipendente && righe.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Correzioni rapide</CardTitle>
            <CardDescription>
              {selected.size > 0
                ? `${selected.size} giorno/i selezionato/i.`
                : "Seleziona una o più righe nella tabella per applicare un preset."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value=""
                onValueChange={applicaPreset}
                disabled={selected.size === 0 || applyingPreset}
              >
                <SelectTrigger
                  className="w-full tabular-nums sm:w-56"
                  aria-label="Applica preset alle righe selezionate"
                >
                  {applyingPreset ? (
                    <Spinner aria-hidden="true" />
                  ) : null}
                  <SelectValue
                    placeholder={
                      selected.size > 0
                        ? `Applica preset (${selected.size})`
                        : "Applica preset"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {presetsApplicabili.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={correzioni.size === 0 || resetting}
                  className="gap-1.5 text-muted-foreground"
                >
                  {resetting ? <Spinner aria-hidden="true" /> : <RotateCwIcon data-icon="inline-start" />}
                  Reset correzioni
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Azzerare tutte le correzioni del mese?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Tutte le correzioni di{" "}
                    {dipendente?.descrizione || dipendente?.codice} per{" "}
                    {meseLabel} verranno eliminate in modo permanente.
                    L&apos;operazione non è reversibile.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={resettaTutto}
                  >
                    Azzera correzioni
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="tabular-nums">{meseLabel}</span>
            {righe.length > 0 && (
              <span className="flex flex-wrap items-center gap-3 text-base font-normal text-muted-foreground tabular-nums">
                <span>Totale: {formattaMinuti(totaliMese.totale)}</span>
                <span>Ord.: {formattaMinuti(totaliMese.ordinario)}</span>
                <span>Straord.: {formattaMinuti(totaliMese.straordinario)}</span>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:px-6 sm:pb-6">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !dipendente ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Seleziona un dipendente e clicca <strong>Carica</strong> per
              visualizzare le timbrature.
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2} className="w-10 text-center">
                          <Checkbox
                            checked={righe.length > 0 && selected.size === righe.length}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Seleziona tutto"
                          />
                        </TableHead>
                        <TableHead
                          rowSpan={2}
                          className="w-16 tabular-nums"
                        >
                          Data
                        </TableHead>
                        <TableHead
                          rowSpan={2}
                          className="tabular-nums"
                        >
                          Giorno
                        </TableHead>
                        <TableHead
                          colSpan={4}
                          className="text-center text-xs font-semibold text-muted-foreground"
                        >
                          Timbrature reali
                        </TableHead>
                        <TableHead
                          colSpan={4}
                          className="text-center text-xs font-semibold text-muted-foreground"
                        >
                          Timbrature corrette
                        </TableHead>
                        <TableHead
                          rowSpan={2}
                          className="w-28 text-right tabular-nums"
                        >
                          Totale
                        </TableHead>
                        <TableHead
                          rowSpan={2}
                          className="w-28 text-right tabular-nums"
                        >
                          Ordinario
                        </TableHead>
                        <TableHead
                          rowSpan={2}
                          className="w-28 text-right tabular-nums"
                        >
                          Straordinario
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className="w-20 text-center tabular-nums font-normal">
                          Entrata
                        </TableHead>
                        <TableHead className="w-20 text-center tabular-nums font-normal">
                          Uscita
                        </TableHead>
                        <TableHead className="w-20 text-center tabular-nums font-normal">
                          Entrata
                        </TableHead>
                        <TableHead className="w-20 text-center tabular-nums font-normal">
                          Uscita
                        </TableHead>
                        <TableHead className="w-20 text-center tabular-nums font-normal">
                          Entrata
                        </TableHead>
                        <TableHead className="w-20 text-center tabular-nums font-normal">
                          Uscita
                        </TableHead>
                        <TableHead className="w-20 text-center tabular-nums font-normal">
                          Entrata
                        </TableHead>
                        <TableHead className="w-20 text-center tabular-nums font-normal">
                          Uscita
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {righe.map((r) => (
                        <TableRow
                          key={r.giorno}
                          className={cn(r.we && "bg-destructive/10")}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selected.has(r.giorno)}
                              onCheckedChange={() => toggleSelect(r.giorno)}
                              aria-label={`Seleziona ${r.giorno}`}
                            />
                          </TableCell>
                          <TableCell
                            className={cn(
                              "tabular-nums",
                              r.we && "text-destructive"
                            )}
                          >
                            {format(new Date(r.giorno + "T12:00:00"), "dd/MM", { locale: it })}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "tabular-nums",
                              r.we && "text-destructive"
                            )}
                          >
                            {format(new Date(r.giorno + "T12:00:00"), "EEEE", { locale: it }).replace(/^./, (c) => c.toUpperCase())}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {r.entrata1?.slice(0, 5) ?? "—"}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {r.uscita1?.slice(0, 5) ?? "—"}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {r.entrata2?.slice(0, 5) ?? "—"}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {r.uscita2?.slice(0, 5) ?? "—"}
                          </TableCell>
                          <CorrettaCell
                            giorno={r.giorno}
                            campo="entrata1"
                            valore={r.ce1}
                            editing={editing}
                            setEditing={setEditing}
                            editRef={editRef}
                            onSave={salvaCorrezione}
                          />
                          <CorrettaCell
                            giorno={r.giorno}
                            campo="uscita1"
                            valore={r.cu1}
                            editing={editing}
                            setEditing={setEditing}
                            editRef={editRef}
                            onSave={salvaCorrezione}
                          />
                          <CorrettaCell
                            giorno={r.giorno}
                            campo="entrata2"
                            valore={r.ce2}
                            editing={editing}
                            setEditing={setEditing}
                            editRef={editRef}
                            onSave={salvaCorrezione}
                          />
                          <CorrettaCell
                            giorno={r.giorno}
                            campo="uscita2"
                            valore={r.cu2}
                            editing={editing}
                            setEditing={setEditing}
                            editRef={editRef}
                            onSave={salvaCorrezione}
                          />
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              r.totale > 0 &&
                                r.totale < 5 * 60 &&
                                "text-muted-foreground",
                              r.totale === 0 && !r.we && "text-muted-foreground"
                            )}
                          >
                            {formattaMinuti(r.totale)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formattaMinuti(r.ordinario)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              r.straordinario > 0 && "text-amber-600"
                            )}
                          >
                            {formattaMinuti(r.straordinario)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {righe.map((r) => (
                  <Card
                    key={r.giorno}
                    size="sm"
                    className={cn(r.we && "bg-destructive/10")}
                  >
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              "tabular-nums",
                              r.we && "text-destructive"
                            )}
                          >
                            {format(new Date(r.giorno + "T12:00:00"), "dd/MM", { locale: it })}
                          </span>
                          <span
                            className={cn(
                              "text-sm font-medium",
                              r.we && "text-destructive"
                            )}
                          >
                            {format(new Date(r.giorno + "T12:00:00"), "EEEE", { locale: it }).replace(/^./, (c) => c.toUpperCase())}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs tabular-nums">
                          <span className={cn(r.totale > 0 && r.totale < 5 * 60 && "text-muted-foreground")}>
                            {formattaMinuti(r.totale)}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-muted-foreground">
                            {formattaMinuti(r.ordinario)}
                          </span>
                          <span
                            className={cn(
                              r.straordinario > 0 && "text-amber-600"
                            )}
                          >
                            {formattaMinuti(r.straordinario)}
                          </span>
                        </div>
                      </div>
                      {!r.we && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            1° turno: {r.entrata1?.slice(0, 5) ?? "—"} – {r.uscita1?.slice(0, 5) ?? "—"}
                          </span>
                          <span>
                            2° turno: {r.entrata2?.slice(0, 5) ?? "—"} – {r.uscita2?.slice(0, 5) ?? "—"}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
