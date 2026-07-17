"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import {
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  MoonIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  UserIcon,
  XIcon,
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
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// Card: solo per le righe della lista mobile — la tabella desktop non sta più
// in una card (la sua cornice è il contenitore scrollabile con bordo).
import { Card, CardContent } from "@/components/ui/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

import { RapportinoRigaCard } from "@/components/admin/rapportino-riga-card"
import { SelettorePeriodo, MESI } from "@/components/admin/selettore-periodo"
import { TimbratureStampaDialog } from "@/components/admin/timbrature-stampa-dialog"
import type { Dipendente } from "@/lib/mysql/timbrature"
import type { RapportinoRiga } from "@/lib/mysql/rapportini"
import { raggruppaPerGiorno, sommaGiorno } from "@/lib/rapportini/calcolo"
import { CALCOLO_DEFAULTS } from "@/lib/settings/schema"
import type { CalcoloSettingsAdmin } from "@/lib/settings/schema"
import {
  calcolaCorretti,
  calcolaTotaliMese,
  isWeekend,
} from "@/lib/timbrature/calcolo"
import type { Anomalia } from "@/lib/timbrature/calcolo"
import type { Giornata } from "@/lib/timbrature/giornate"
import { ORARIO_REGEX, mascheraOrario } from "@/lib/timbrature/ora"
import type { StampaTemplateId } from "@/lib/timbrature/stampa/catalog"

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

// Colonne che precedono il blocco delle ore: checkbox, stato, data, i 4 turni
// reali e i 4 corretti. È il colSpan dell'etichetta «Totale mese» nel footer:
// tenerlo qui evita di doverlo ricontare a mano a ogni colonna aggiunta.
const COLONNE_TESTA = 11

// Le 8 colonne di orari sono due gruppi da quattro (reali e corretti). La
// tabella è a larghezza piena e le colonne chiedono meno di quanto c'è: il
// layout automatico ridistribuisce l'avanzo su tutte, quindi le larghezze qui
// sono solo un'indicazione (stringerle non «recupera» spazio, lo sposta).
// Quello che invece si vede è il padding: `COL_ORA_GRUPPO` apre il blocco dei
// corretti con un rientro largo, così l'occhio separa i due gruppi senza
// bisogno di un bordo. La larghezza dev'essere ≥ rientro + input di modifica
// (w-14), altrimenti la colonna si allarga appena si entra in editing.
const COL_ORA = "w-16 px-1"
const COL_ORA_GRUPPO = "w-28 pl-12 pr-1"

// Header fisso mentre si scorrono i 31 giorni. Il fondo dev'essere opaco (le
// righe ci passano sotto) e la riga di separazione è un `inset shadow`: con
// `border-collapse: collapse` i bordi di una cella sticky non vengono
// ridipinti durante lo scroll. L'offset (`top-*`) lo mette chi la usa: la
// seconda riga di intestazione parte sotto la prima (`h-10`).
const THEAD_STICKY =
  "sticky z-10 bg-background shadow-[inset_0_-1px_0_var(--border)]"

// Stessa idea per il totale del mese, ancorato in basso: resta leggibile senza
// dover scorrere fino in fondo. `bg-muted` pieno (non /50) o le righe traspaiono.
const TFOOT_STICKY =
  "sticky bottom-0 z-10 bg-muted shadow-[inset_0_1px_0_var(--border)]"

// Riga di correzione come arriva dall'API (i turni non corretti sono null).
type CorrezioneRaw = {
  giorno: string
  entrata1?: string | null
  uscita1?: string | null
  entrata2?: string | null
  uscita2?: string | null
  revisionata?: boolean
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

// «Lun» / «Lunedì»: date-fns rende il giorno in minuscolo in italiano.
function nomeGiorno(d: Date, formato: "EEE" | "EEEE"): string {
  return format(d, formato, { locale: it }).replace(/^./, (c) => c.toUpperCase())
}

function formattaMinuti(minuti: number): string {
  if (minuti === 0) return "—"
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${h}h ${m}m`
}

function pluraleGiornate(n: number): string {
  return n === 1 ? "1 giornata" : `${n} giornate`
}

// Gli orari che un preset applicherà, in chiaro: chi corregge deve poterli
// leggere prima di confermare, non scoprirli dopo. Un turno vuoto nel preset
// azzera il turno corrispondente (vedi `applicaPreset`), e lo diciamo.
function descriviPreset(p: Preset): string {
  const turno = (da: string | null, a: string | null) =>
    da && a ? `${da}–${a}` : null
  const primo = turno(p.entrata1, p.uscita1)
  const secondo = turno(p.entrata2, p.uscita2)
  if (!primo && !secondo) return "Nessun orario · azzera la giornata"
  return [primo ?? "1° turno azzerato", secondo ?? "2° turno azzerato"].join(
    " · "
  )
}

const ANOMALIA_LABEL: Record<Anomalia, string> = {
  entrata_mancante: "Entrata mancante",
  uscita_mancante: "Uscita mancante",
  turno_incompleto: "Turno incompleto",
  timbratura_sospetta: "Timbratura sospetta (00:00)",
  durata_eccessiva: "Durata eccessiva",
  assente: "Assente",
}

// Icona di stato della giornata, cliccabile: apre la Sheet di dettaglio
// (anomalie + righe di rapportino insieme, vedi GiornoDettaglioSheet più
// sotto) invece del solo hover di prima. Il glifo resta lo stesso: un badge
// rosso (icona + conteggio) per le anomalie da rivedere, una spunta muted sui
// giorni feriali senza anomalie — conferma che la colonna non è vuota per
// errore, è stata controllata ed è a posto. Un giorno revisionato usa la
// STESSA spunta muted di un giorno senza anomalie (le anomalie restano
// calcolate, il motore non lo sa nemmeno: è solo nascosto alla vista)
// deliberatamente indistinguibile a colpo d'occhio, la Sheet resta l'unico
// modo per sapere che è stato rivisto a mano. Nel weekend, dove di norma non
// ci si aspetta nulla, l'icona resta vuota — A MENO che un rapportino non
// esista comunque per quel giorno (es. intervento di sabato): in quel caso
// compare per poter aprire il dettaglio.
function StatoIcon({
  anomalie,
  weekend,
  revisionata,
  haRapportino,
  onClick,
}: {
  anomalie: Anomalia[]
  weekend: boolean
  revisionata: boolean
  haRapportino: boolean
  onClick: () => void
}) {
  const haAnomalie = anomalie.length > 0 && !revisionata
  if (!haAnomalie && weekend && !haRapportino) return null

  const etichette = anomalie.map((a) => ANOMALIA_LABEL[a]).join(" · ")
  const label = haAnomalie
    ? `Anomalie: ${etichette}`
    : revisionata && anomalie.length > 0
      ? `Revisionata: ${etichette}`
      : "Dettaglio giornata"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {haAnomalie ? (
          <Badge
            role="button"
            tabIndex={0}
            variant="destructive"
            className="cursor-pointer align-middle outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={label}
            onClick={onClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }}
          >
            <TriangleAlertIcon data-icon="inline-start" aria-hidden="true" />
            {anomalie.length}
          </Badge>
        ) : (
          <CheckIcon
            role="button"
            tabIndex={0}
            className="mx-auto size-4 cursor-pointer text-muted-foreground/60 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={label}
            onClick={onClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }}
          />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// Riga della tabella con il minimo che serve alla Sheet di dettaglio: non un
// tipo esportato, solo la forma che `righe` (costruito più sotto) già
// rispetta strutturalmente.
type RigaConDettaglio = {
  data: Date
  anomalie: Anomalia[]
  revisionata: boolean
  righeRapportino: RapportinoRiga[]
  pernottamento: boolean
}

// Sheet unica per il dettaglio di un giorno: riunisce ciò che prima erano due
// cose separate (il Tooltip delle anomalie e il dettaglio delle righe di
// rapportino). Aperta dal click sull'icona di stato (StatoIcon), mostra
// entrambe le informazioni insieme così l'admin non deve più indovinare dove
// guardare.
function GiornoDettaglioSheet({
  riga,
  open,
  onOpenChange,
}: {
  riga: RigaConDettaglio | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {riga && (
              <>
                {format(riga.data, "dd MMMM yyyy", { locale: it })}
                <span className="text-muted-foreground">
                  {" · "}
                  {nomeGiorno(riga.data, "EEEE")}
                </span>
              </>
            )}
          </SheetTitle>
          {riga?.revisionata && (
            <SheetDescription>
              Giorno segnato come revisionato.
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          {riga && riga.anomalie.length > 0 && (
            <div className="rounded-lg border border-destructive/15 bg-destructive/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <TriangleAlertIcon className="size-4" aria-hidden="true" />
                <span>
                  {riga.anomalie.length === 1
                    ? "1 anomalia"
                    : `${riga.anomalie.length} anomalie`}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {riga.anomalie.map((a) => (
                  <li
                    key={a}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-destructive"
                      aria-hidden="true"
                    />
                    {ANOMALIA_LABEL[a]}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {riga && (riga.righeRapportino.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <FileTextIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                {riga.righeRapportino.length === 1
                  ? "1 rapportino elaborato"
                  : `${riga.righeRapportino.length} rapportini elaborati`}
              </h3>
              {riga.righeRapportino.map((r) => (
                <RapportinoRigaCard key={r.progressivo} riga={r} />
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>Nessun rapportino</EmptyTitle>
                <EmptyDescription>
                  Nessun rapportino elaborato per questo giorno.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CorrettaCell({
  giorno,
  campo,
  valore,
  editing,
  setEditing,
  editRef,
  onSave,
  className,
}: {
  giorno: string
  campo: string
  valore: string | null
  editing: { giorno: string; campo: string } | null
  setEditing: (k: { giorno: string; campo: string } | null) => void
  editRef: React.RefObject<HTMLInputElement | null>
  onSave: (giorno: string, campo: string, v: string | null) => void
  className?: string
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
      <TableCell className={cn("p-1 text-center", className)}>
        <Input
          ref={editRef}
          value={draft}
          inputMode="numeric"
          placeholder="HH:MM"
          aria-invalid={invalid}
          // `w-full` da solo non basta: in una tabella ad auto-layout un input
          // percentuale non partecipa al calcolo max-content della colonna, e il
          // browser ricade sulla sua larghezza intrinseca (~20 caratteri) — molto
          // più della colonna, che quindi si allarga. Una larghezza fissa (in rem,
          // non %) tiene l'input dentro alla colonna che ha già "Entrata"/"Uscita";
          // deve stare dentro `COL_ORA` (w-16) al netto del suo padding, altrimenti
          // la colonna si allarga appena si entra in modifica.
          className="h-8 w-14 px-1 text-center text-corretto tabular-nums"
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
          className={cn(
            "cursor-pointer text-center tabular-nums outline-none hover:bg-muted/20 focus-visible:ring-3 focus-visible:ring-ring/50",
            // Il blu non ha un significato: tinge tutte e quattro le colonne
            // corrette, così il blocco si stacca a colpo d'occhio da quello dei
            // dati grezzi. Tutte le celle si comportano allo stesso modo, a
            // prescindere da come il valore è stato ottenuto.
            valore == null ? "text-muted-foreground" : "text-corretto",
            className
          )}
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

export function TimbratureManager({
  templatePredefinito,
}: {
  templatePredefinito: StampaTemplateId
}) {
  const def = meseCorrente()
  const [mese, setMese] = useState(def.mese)
  const [anno, setAnno] = useState(def.anno)
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([])
  const [dipendente, setDipendente] = useState<Dipendente | null>(null)
  const [giornate, setGiornate] = useState<Giornata[]>([])
  // Rapportini di assistenza tecnica del mese (tabella `cmd`): quando un
  // giorno ne ha, guidano il calcolo al posto del marcatempo (vedi
  // lib/timbrature/calcolo.ts, 5° parametro di calcolaCorretti).
  const [rapportini, setRapportini] = useState<RapportinoRiga[]>([])
  const [orario, setOrario] = useState({
    primoIngresso: "08:00",
    primaUscita: "12:00",
    secondoIngresso: "13:30",
    secondaUscita: "17:30",
  })
  const [regole, setRegole] = useState<CalcoloSettingsAdmin>(CALCOLO_DEFAULTS)
  const [vista, setVista] = useState<"tutte" | "anomalie">("tutte")
  const [loading, setLoading] = useState(false)
  const [loadingDip, setLoadingDip] = useState(true)
  const [correzioni, setCorrezioni] = useState<
    Map<string, Record<string, string | null>>
  >(new Map())
  // Giorni segnati come revisionati: filtro di visualizzazione, indipendente
  // dalle correzioni (vedi `TimbraturaCorretta.revisionata` in schema.prisma).
  const [revisionati, setRevisionati] = useState<Set<string>>(new Set())
  const [applyingPreset, setApplyingPreset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [revisionando, setRevisionando] = useState(false)
  const [presets, setPresets] = useState<Preset[]>([])

  // Conferma delle azioni di massa. Il contenuto del dialog sta in uno stato
  // separato dall'`open`: confermando si svuota la selezione, e un testo legato
  // a `selected.size` direbbe «0 giornate» durante l'animazione di chiusura.
  type Conferma =
    | { tipo: "preset"; preset: Preset; n: number }
    | { tipo: "reset"; n: number }
  const [conferma, setConferma] = useState<Conferma | null>(null)
  const [confermaOpen, setConfermaOpen] = useState(false)

  function chiediConferma(c: Conferma) {
    setConferma(c)
    setConfermaOpen(true)
  }

  type EditingKey = { giorno: string; campo: string }
  const [editing, setEditing] = useState<EditingKey | null>(null)
  const editRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dettaglioGiorno, setDettaglioGiorno] = useState<string | null>(null)
  const richiestaRef = useRef(0)

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

  // Applica un preset alle giornate selezionate. La correzione riflette
  // esattamente il preset: i turni valorizzati diventano il valore corretto, i
  // turni vuoti vengono azzerati con stringa vuota (`""`), così sovrascrivono
  // anche il dato reale invece di ricadervi.
  async function applicaPreset(preset: Preset) {
    if (!dipendente || selected.size === 0) return
    const campi = {
      entrata1: preset.entrata1 ?? "",
      uscita1: preset.uscita1 ?? "",
      entrata2: preset.entrata2 ?? "",
      uscita2: preset.uscita2 ?? "",
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
      setCorrezioni((prev) => {
        const next = new Map(prev)
        for (const giorno of selected) next.set(giorno, campi)
        return next
      })
      toast.success(
        `«${preset.nome}» applicato a ${pluraleGiornate(selected.size)}`
      )
      setSelected(new Set())
    } catch {
      toast.error("Impossibile applicare l'orario")
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

  async function resettaSelezionate() {
    if (!dipendente || selected.size === 0) return
    setResetting(true)
    try {
      await Promise.all(
        Array.from(selected).map((giorno) =>
          fetch(
            `/api/admin/timbrature/correzioni?dipendente=${dipendente.codice}&giorno=${giorno}`,
            { method: "DELETE" }
          ).then((r) => {
            if (!r.ok) throw new Error()
          })
        )
      )
      setCorrezioni((prev) => {
        const next = new Map(prev)
        for (const giorno of selected) next.delete(giorno)
        return next
      })
      // La DELETE elimina la riga intera: anche il flag `revisionata` sparisce.
      setRevisionati((prev) => {
        const next = new Set(prev)
        for (const giorno of selected) next.delete(giorno)
        return next
      })
      toast.success(`Correzioni azzerate per ${pluraleGiornate(selected.size)}`)
      setSelected(new Set())
    } catch {
      toast.error("Impossibile azzerare le correzioni")
    } finally {
      setResetting(false)
    }
  }

  // Segna (o smarca) come revisionate le giornate selezionate. Un toggle di
  // gruppo: se anche solo una delle selezionate è già revisionata, l'azione le
  // smarca tutte; altrimenti le segna tutte. Non tocca gli orari — il motore
  // di calcolo (calcolo.ts) resta all'oscuro di questo flag, letto solo qui e
  // nella stampa PDF per nascondere badge/tinta/conteggio.
  async function toggleRevisione() {
    if (!dipendente || selected.size === 0) return
    const smarca = Array.from(selected).some((g) => revisionati.has(g))
    setRevisionando(true)
    try {
      await Promise.all(
        Array.from(selected).map((giorno) =>
          fetch("/api/admin/timbrature/correzioni", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dipendente: dipendente.codice,
              giorno,
              revisionata: !smarca,
            }),
          }).then((r) => {
            if (!r.ok) throw new Error()
          })
        )
      )
      setRevisionati((prev) => {
        const next = new Set(prev)
        for (const giorno of selected) {
          if (smarca) next.delete(giorno)
          else next.add(giorno)
        }
        return next
      })
      toast.success(
        smarca
          ? `Revisione rimossa per ${pluraleGiornate(selected.size)}`
          : `Revisione registrata per ${pluraleGiornate(selected.size)}`
      )
      setSelected(new Set())
    } catch {
      toast.error("Impossibile aggiornare la revisione")
    } finally {
      setRevisionando(false)
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
    const richiesta = ++richiestaRef.current
    setLoading(true)
    setCorrezioni(new Map())
    setRevisionati(new Set())
    setSelected(new Set())
    // Il filtro è una vista sul mese caricato: un altro mese (o un altro
    // dipendente) può non avere anomalie, e resterebbe «filtrato» a vuoto.
    setVista("tutte")
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
      // I rapportini sono un'estensione: se il DB esterno non li espone (o la
      // richiesta fallisce) la pagina non deve rompersi, solo restare senza —
      // il marcatempo da solo è il comportamento di sempre.
      fetch(`/api/admin/rapportini?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : { rapportini: [] }))
        .catch(() => ({ rapportini: [] })),
    ])
      .then(
        ([data, correzioniRaw, rapportiniData]: [
          {
            giornate: Giornata[]
            orario: typeof orario
            regole: CalcoloSettingsAdmin
          },
          CorrezioneRaw[],
          { rapportini: RapportinoRiga[] },
        ]) => {
          if (richiesta !== richiestaRef.current) return
          setGiornate(data.giornate)
          setOrario(data.orario)
          setRegole(data.regole)
          setRapportini(rapportiniData.rapportini)
          setCorrezioni(
            new Map(
              correzioniRaw.map((c) => [
                c.giorno,
                {
                  ...(c.entrata1 !== null && { entrata1: c.entrata1 }),
                  ...(c.uscita1 !== null && { uscita1: c.uscita1 }),
                  ...(c.entrata2 !== null && { entrata2: c.entrata2 }),
                  ...(c.uscita2 !== null && { uscita2: c.uscita2 }),
                },
              ])
            )
          )
          setRevisionati(
            new Set(
              correzioniRaw.filter((c) => c.revisionata).map((c) => c.giorno)
            )
          )
          setLoading(false)
        }
      )
      .catch(() => {
        if (richiesta !== richiestaRef.current) return
        toast.error("Impossibile caricare le timbrature")
        setLoading(false)
      })
  }, [dipendente, mese, anno])

  useEffect(() => {
    const timer = setTimeout(() => carica(), 0)
    return () => clearTimeout(timer)
  }, [carica])

  const meseLabel = `${MESI[mese]} ${anno}`

  // Ricalcolo a ogni render: sono al massimo 31 righe di aritmetica, e un
  // useMemo qui impedirebbe al React Compiler di ottimizzare il componente.
  const rapportiniPerGiorno = raggruppaPerGiorno(rapportini)
  const righe = giornate.map((g) => {
    const righeRapportino = rapportiniPerGiorno.get(g.giorno) ?? []
    return {
      ...g,
      ...calcolaCorretti(
        g,
        correzioni.get(g.giorno),
        regole,
        orario,
        sommaGiorno(righeRapportino)
      ),
      righeRapportino,
      we: isWeekend(g.giornoSettimana),
      revisionata: revisionati.has(g.giorno),
      // Mezzogiorno: la data è un giorno civile, non un istante — così nessun
      // fuso la fa scivolare al giorno prima.
      data: new Date(g.giorno + "T12:00:00"),
    }
  })

  // Totali sempre sull'intero mese; il filtro anomalie è solo una vista. Un
  // giorno revisionato ha ancora `anomalie` piene (il motore non lo sa), ma
  // conta come "a posto": è ciò che rende la revisione un filtro di
  // visualizzazione e non un secondo sistema di correzione.
  const totaliMese = calcolaTotaliMese(righe)
  const daVerificare = (r: (typeof righe)[number]) =>
    !r.revisionata && r.anomalie.length > 0
  const nAnomalie = righe.filter(daVerificare).length
  const righeVisibili =
    vista === "anomalie" && nAnomalie > 0 ? righe.filter(daVerificare) : righe

  const nSelezionate = selected.size
  const nomeDipendente = dipendente
    ? dipendente.descrizione || dipendente.codice
    : null
  const inCorso = applyingPreset || resetting || revisionando
  const selezioneSmarca = Array.from(selected).some((g) => revisionati.has(g))
  const rigaDettaglio = righe.find((r) => r.giorno === dettaglioGiorno) ?? null

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar di contesto: chi e quando. Sono filtri, non un form: niente
          card attorno, così la pagina ha una sola scatola — il registro. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Combobox
          items={dipendenti}
          value={dipendente}
          onValueChange={setDipendente}
        >
          <ComboboxTrigger
            render={
              <Button
                variant="outline"
                className="w-full justify-between font-normal sm:w-64"
                aria-label={
                  nomeDipendente
                    ? `Dipendente: ${nomeDipendente}`
                    : "Seleziona dipendente"
                }
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
            <ComboboxInput
              showTrigger={false}
              placeholder="Cerca dipendente..."
            />
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

        <SelettorePeriodo
          mese={mese}
          anno={anno}
          onCambia={(m, a) => {
            setMese(m)
            setAnno(a)
          }}
        />

        <TimbratureStampaDialog
          dipendente={dipendente}
          mese={mese + 1}
          anno={anno}
          meseLabel={meseLabel}
          templatePredefinito={templatePredefinito}
          disabled={loading}
          className="sm:ml-auto"
        />
      </div>

      {/* Niente card attorno alla tabella: la tabella ha già la sua cornice
          (il contenitore scrollabile con bordo) e una card in più le toglierebbe
          solo larghezza. Sopra, una barra: di norma dice cosa stai guardando, con
          righe selezionate diventa la barra delle azioni di massa. `min-h-9` e
          `items-center` la tengono alta uguale nei due stati: la tabella non si
          sposta quando compare la selezione. */}
      <div className="flex flex-col gap-3">
        {dipendente && righe.length > 0 && (
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
            {nSelezionate > 0 ? (
              <>
                <div className="flex items-center gap-1">
                  <span className="font-medium tabular-nums">
                    {nSelezionate === 1
                      ? "1 giornata selezionata"
                      : `${nSelezionate} giornate selezionate`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setSelected(new Set())}
                  >
                    <XIcon data-icon="inline-start" />
                    Annulla selezione
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={inCorso}>
                        {applyingPreset ? (
                          <Spinner aria-hidden="true" />
                        ) : (
                          <ClockIcon data-icon="inline-start" />
                        )}
                        Applica orario
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-auto min-w-56"
                    >
                      {presetsApplicabili.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          className="flex-col items-start gap-0 py-1.5"
                          onSelect={() =>
                            chiediConferma({
                              tipo: "preset",
                              preset: p,
                              n: nSelezionate,
                            })
                          }
                        >
                          <span className="font-medium">{p.nome}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {descriviPreset(p)}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="outline"
                    disabled={inCorso}
                    onClick={toggleRevisione}
                  >
                    {revisionando ? (
                      <Spinner aria-hidden="true" />
                    ) : selezioneSmarca ? (
                      <TriangleAlertIcon data-icon="inline-start" />
                    ) : (
                      <CheckIcon data-icon="inline-start" />
                    )}
                    {selezioneSmarca
                      ? "Segna come da rivedere"
                      : "Segnala come revisionato"}
                  </Button>

                  <Button
                    variant="outline"
                    disabled={inCorso}
                    onClick={() =>
                      chiediConferma({ tipo: "reset", n: nSelezionate })
                    }
                  >
                    {resetting ? (
                      <Spinner aria-hidden="true" />
                    ) : (
                      <RotateCcwIcon data-icon="inline-start" />
                    )}
                    Azzera correzioni
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {nomeDipendente}
                  </span>
                  <span className="tabular-nums">
                    {" · "}
                    {meseLabel} · {pluraleGiornate(righe.length)}
                  </span>
                </p>
                <Tabs
                  value={vista}
                  onValueChange={(v) => setVista(v as typeof vista)}
                >
                  <TabsList>
                    <TabsTrigger value="tutte">Tutte</TabsTrigger>
                    <TabsTrigger value="anomalie" disabled={nAnomalie === 0}>
                      <TriangleAlertIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      Da verificare
                      <Badge
                        variant={nAnomalie > 0 ? "destructive" : "secondary"}
                        className="tabular-nums"
                      >
                        {nAnomalie}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !dipendente ? (
          <Empty className="rounded-lg border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserIcon />
              </EmptyMedia>
              <EmptyTitle>Nessun dipendente selezionato</EmptyTitle>
              <EmptyDescription>
                Seleziona un dipendente per visualizzare le timbrature del
                periodo.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="hidden md:block">
              <Table containerClassName="max-h-[70vh] overflow-auto rounded-lg border">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      rowSpan={2}
                      className={cn(THEAD_STICKY, "top-0 w-10 text-center")}
                    >
                      <Checkbox
                        checked={
                          righe.length > 0 && selected.size === righe.length
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Seleziona tutto"
                      />
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className={cn(THEAD_STICKY, "top-0 w-20 text-center")}
                    >
                      Stato
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className={cn(THEAD_STICKY, "top-0 w-24 tabular-nums")}
                    >
                      Data
                    </TableHead>
                    <TableHead
                      colSpan={4}
                      className={cn(
                        THEAD_STICKY,
                        "top-0 text-center text-xs font-semibold text-muted-foreground"
                      )}
                    >
                      Timbrature reali
                    </TableHead>
                    <TableHead
                      colSpan={4}
                      className={cn(
                        THEAD_STICKY,
                        "top-0 text-center text-xs font-semibold text-muted-foreground"
                      )}
                    >
                      Timbrature corrette
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className={cn(
                        THEAD_STICKY,
                        "top-0 w-28 text-right tabular-nums"
                      )}
                    >
                      Ordinario
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className={cn(
                        THEAD_STICKY,
                        "top-0 w-28 text-right tabular-nums"
                      )}
                    >
                      Straord. lavoro
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className={cn(
                        THEAD_STICKY,
                        "top-0 w-28 text-right tabular-nums"
                      )}
                    >
                      Straord. viaggio
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    {[
                      "Entrata",
                      "Uscita",
                      "Entrata",
                      "Uscita",
                      "Entrata",
                      "Uscita",
                      "Entrata",
                      "Uscita",
                    ].map((label, i) => (
                      <TableHead
                        key={i}
                        className={cn(
                          THEAD_STICKY,
                          "top-10 text-center font-normal",
                          COL_ORA,
                          i === 4 && COL_ORA_GRUPPO
                        )}
                      >
                        {label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {righeVisibili.map((r) => (
                    <TableRow
                      key={r.giorno}
                      // Le giornate da rivedere si distinguono anche senza
                      // filtrare: la tinta vince su quella del weekend.
                      className={cn(
                        r.we && "bg-muted/40",
                        daVerificare(r) && "bg-destructive/5"
                      )}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selected.has(r.giorno)}
                          onCheckedChange={() => toggleSelect(r.giorno)}
                          aria-label={`Seleziona ${r.giorno}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatoIcon
                          anomalie={r.anomalie}
                          weekend={r.we}
                          revisionata={r.revisionata}
                          haRapportino={r.righeRapportino.length > 0}
                          onClick={() => setDettaglioGiorno(r.giorno)}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <div className="flex items-center gap-1.5">
                          {format(r.data, "dd", { locale: it })}{" "}
                          <span className="text-muted-foreground">
                            {nomeGiorno(r.data, "EEE")}
                          </span>
                          {r.pernottamento && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <MoonIcon
                                  className="size-3.5 shrink-0 text-muted-foreground"
                                  aria-label="Pernotto"
                                />
                              </TooltipTrigger>
                              <TooltipContent>Pernotto</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn("text-center tabular-nums", COL_ORA)}
                      >
                        {r.entrata1?.slice(0, 5) ?? "—"}
                      </TableCell>
                      <TableCell
                        className={cn("text-center tabular-nums", COL_ORA)}
                      >
                        {r.uscita1?.slice(0, 5) ?? "—"}
                      </TableCell>
                      <TableCell
                        className={cn("text-center tabular-nums", COL_ORA)}
                      >
                        {r.entrata2?.slice(0, 5) ?? "—"}
                      </TableCell>
                      <TableCell
                        className={cn("text-center tabular-nums", COL_ORA)}
                      >
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
                        className={cn(COL_ORA, COL_ORA_GRUPPO)}
                      />
                      <CorrettaCell
                        giorno={r.giorno}
                        campo="uscita1"
                        valore={r.cu1}
                        editing={editing}
                        setEditing={setEditing}
                        editRef={editRef}
                        onSave={salvaCorrezione}
                        className={COL_ORA}
                      />
                      <CorrettaCell
                        giorno={r.giorno}
                        campo="entrata2"
                        valore={r.ce2}
                        editing={editing}
                        setEditing={setEditing}
                        editRef={editRef}
                        onSave={salvaCorrezione}
                        className={COL_ORA}
                      />
                      <CorrettaCell
                        giorno={r.giorno}
                        campo="uscita2"
                        valore={r.cu2}
                        editing={editing}
                        setEditing={setEditing}
                        editRef={editRef}
                        onSave={salvaCorrezione}
                        className={COL_ORA}
                      />
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          // Il muted segnala una giornata corta o vuota: valutato
                          // sul totale effettivo (non sull'ordinario, che coincide
                          // col totale finché non scatta lo straordinario).
                          r.totale > 0 &&
                            r.totale < 5 * 60 &&
                            "text-muted-foreground",
                          r.totale === 0 && !r.we && "text-muted-foreground"
                        )}
                      >
                        {formattaMinuti(r.ordinario)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          r.straordinario > 0 && "text-straordinario"
                        )}
                      >
                        {formattaMinuti(r.straordinario)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          r.straordinarioViaggio > 0 && "text-straordinario"
                        )}
                      >
                        {formattaMinuti(r.straordinarioViaggio)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {righe.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell
                        colSpan={COLONNE_TESTA}
                        className={cn(TFOOT_STICKY, "text-right")}
                      >
                        Totale mese{" "}
                        <span className="font-semibold tabular-nums">
                          {formattaMinuti(totaliMese.totale)}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(TFOOT_STICKY, "text-right tabular-nums")}
                      >
                        {formattaMinuti(totaliMese.ordinario)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          TFOOT_STICKY,
                          "text-right tabular-nums",
                          totaliMese.straordinario > 0 && "text-straordinario"
                        )}
                      >
                        {formattaMinuti(totaliMese.straordinario)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          TFOOT_STICKY,
                          "text-right tabular-nums",
                          totaliMese.straordinarioViaggio > 0 &&
                            "text-straordinario"
                        )}
                      >
                        {formattaMinuti(totaliMese.straordinarioViaggio)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>

              {/* Le icone di stato hanno un significato preciso: qui c'è il
                    vocabolario, invece di lasciarlo indovinare. */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <TriangleAlertIcon
                    className="size-3 text-destructive"
                    aria-hidden="true"
                  />
                  = giornata da verificare
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckIcon
                    className="size-3 text-muted-foreground/60"
                    aria-hidden="true"
                  />
                  = nessuna anomalia (o giorno revisionato)
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {righeVisibili.map((r) => (
                <Card
                  key={r.giorno}
                  size="sm"
                  className={cn(r.we && "bg-muted/40")}
                >
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="tabular-nums">
                          {format(r.data, "dd/MM", { locale: it })}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                          {nomeGiorno(r.data, "EEEE")}
                        </span>
                        {r.pernottamento && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <MoonIcon
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-label="Pernotto"
                              />
                            </TooltipTrigger>
                            <TooltipContent>Pernotto</TooltipContent>
                          </Tooltip>
                        )}
                        <StatoIcon
                          anomalie={r.anomalie}
                          weekend={r.we}
                          revisionata={r.revisionata}
                          haRapportino={r.righeRapportino.length > 0}
                          onClick={() => setDettaglioGiorno(r.giorno)}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs tabular-nums">
                        <span
                          className={cn(
                            r.totale > 0 &&
                              r.totale < 5 * 60 &&
                              "text-muted-foreground"
                          )}
                        >
                          {formattaMinuti(r.ordinario)}
                        </span>
                        {/* Straordinario lavoro+viaggio combinato: la
                            distinzione resta nella Sheet/tabella desktop, qui
                            c'è spazio solo per un numero. */}
                        <span
                          className={cn(
                            (r.straordinario > 0 ||
                              r.straordinarioViaggio > 0) &&
                              "text-straordinario"
                          )}
                        >
                          {formattaMinuti(r.straordinario + r.straordinarioViaggio)}
                        </span>
                      </div>
                    </div>
                    {!r.we && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          1° turno: {r.entrata1?.slice(0, 5) ?? "—"} –{" "}
                          {r.uscita1?.slice(0, 5) ?? "—"}
                        </span>
                        <span>
                          2° turno: {r.entrata2?.slice(0, 5) ?? "—"} –{" "}
                          {r.uscita2?.slice(0, 5) ?? "—"}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {righe.length > 0 && (
                <Card size="sm">
                  <CardContent className="flex items-center justify-between p-4 text-sm">
                    <span className="font-medium">
                      Totale mese{" "}
                      <span className="font-semibold tabular-nums">
                        {formattaMinuti(totaliMese.totale)}
                      </span>
                    </span>
                    <div className="flex items-center gap-2 text-xs tabular-nums">
                      <span>{formattaMinuti(totaliMese.ordinario)}</span>
                      <span
                        className={cn(
                          (totaliMese.straordinario > 0 ||
                            totaliMese.straordinarioViaggio > 0) &&
                            "text-straordinario"
                        )}
                      >
                        {formattaMinuti(
                          totaliMese.straordinario + totaliMese.straordinarioViaggio
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      {/* Le conferme vivono qui, fuori dall'header: confermando, la selezione si
          svuota e l'header torna al suo contenuto normale — un dialog montato lì
          dentro sparirebbe a metà dell'animazione di chiusura. */}
      <AlertDialog open={confermaOpen} onOpenChange={setConfermaOpen}>
        <AlertDialogContent>
          {conferma?.tipo === "preset" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Applicare «{conferma.preset.nome}» a{" "}
                  {pluraleGiornate(conferma.n)}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Gli orari corretti diventeranno{" "}
                  <span className="tabular-nums">
                    {descriviPreset(conferma.preset)}
                  </span>
                  , sostituendo le correzioni già presenti. Le timbrature reali
                  del marcatempo non vengono modificate.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => applicaPreset(conferma.preset)}
                >
                  Applica orario
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {conferma?.tipo === "reset" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Azzerare le correzioni di {pluraleGiornate(conferma.n)}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Le correzioni di {nomeDipendente} su{" "}
                  {pluraleGiornate(conferma.n)} verranno eliminate in modo
                  permanente e gli orari torneranno a quelli del marcatempo.
                  L&apos;operazione non è reversibile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={resettaSelezionate}
                >
                  Azzera correzioni
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <GiornoDettaglioSheet
        riga={rigaDettaglio}
        open={dettaglioGiorno !== null}
        onOpenChange={(open) => !open && setDettaglioGiorno(null)}
      />
    </div>
  )
}
