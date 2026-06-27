"use client"

import { useEffect, useMemo, useState } from "react"
import cronstrue from "cronstrue/i18n"
import {
  CalendarClockIcon,
  FileTextIcon,
  PlayIcon,
  RefreshCwIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// --- Tipi allineati a lib/jobs ----------------------------------------------
type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

type JobField = {
  name: string
  label: string
  help?: string
  type: "text" | "textarea" | "number" | "boolean" | "select"
  required?: boolean
  placeholder?: string
  default?: string | number | boolean
  min?: number
  max?: number
  options?: { value: string; label: string }[]
}

type JobType = { type: string; label: string; fields: JobField[] }

type Job = {
  id: string
  type: string
  status: JobStatus
  progress: number
  message: string | null
  logs: string[]
  error: string | null
  cancelRequested: boolean
  scheduleKey: string | null
  createdAt: string
}

type Schedule = {
  key: string
  type: string
  cron: string
  timezone: string
  human: string | null
  nextRun: string | null
  lastRun: { status: JobStatus; at: string } | null
}

type FormValues = Record<string, string | number | boolean>

const POLL_MS = 1500

const STATUS_META: Record<
  JobStatus,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
  }
> = {
  queued: { label: "In coda", variant: "secondary" },
  running: { label: "In esecuzione", variant: "default" },
  completed: { label: "Completato", variant: "outline" },
  failed: { label: "Fallito", variant: "destructive" },
  cancelled: { label: "Annullato", variant: "outline" },
}

const isActive = (s: JobStatus) => s === "queued" || s === "running"
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  })

// Fusi orari offerti per le schedulazioni (default: Europe/Rome).
const TIMEZONES = [
  "Europe/Rome",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
]

// Valore corrente di un campo (valore inserito → default → vuoto coerente col tipo).
function fieldValue(
  values: FormValues,
  f: JobField
): string | number | boolean {
  const v = values[f.name]
  if (v !== undefined) return v
  if (f.default !== undefined) return f.default
  if (f.type === "boolean") return false
  if (f.type === "select") return f.options?.[0]?.value ?? ""
  return ""
}

// Costruisce il payload dalla maschera: numeri convertiti, booleani sempre
// presenti, stringhe/select vuote omesse (lascia agire i default lato Zod).
function buildPayload(fields: JobField[], values: FormValues) {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const raw = fieldValue(values, f)
    if (f.type === "boolean") {
      out[f.name] = Boolean(raw)
    } else if (f.type === "number") {
      const n = Number(raw)
      if (raw !== "" && !Number.isNaN(n)) out[f.name] = n
    } else if (raw !== "") {
      out[f.name] = raw
    }
  }
  return out
}

export function JobsManager() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [types, setTypes] = useState<JobType[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedType, setSelectedType] = useState<string>("")
  const [values, setValues] = useState<FormValues>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  // Stato del cron builder (tenuto qui per evitare setState negli effetti).
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleName, setScheduleName] = useState("")
  const [tz, setTz] = useState("Europe/Rome")
  const [freq, setFreq] = useState<Freq>("giorno")
  const [everyN, setEveryN] = useState(15)
  const [atMinute, setAtMinute] = useState(0)
  const [time, setTime] = useState("03:00")
  const [weekday, setWeekday] = useState("1")
  const [dom, setDom] = useState(1)
  const [scheduling, setScheduling] = useState(false)

  const cron = useMemo(
    () => buildCron({ freq, everyN, atMinute, time, weekday, dom }),
    [freq, everyN, atMinute, time, weekday, dom]
  )

  const currentType = types.find((t) => t.type === selectedType)
  const fields = currentType?.fields ?? []

  async function reloadJobs() {
    const res = await fetch("/api/admin/jobs")
    if (!res.ok) throw new Error("Caricamento operazioni non riuscito")
    const data = (await res.json()) as { jobs: Job[]; types: JobType[] }
    setJobs(data.jobs)
    setTypes(data.types)
    setSelectedType((prev) => prev || data.types[0]?.type || "")
  }

  async function reloadSchedules() {
    const res = await fetch("/api/admin/jobs/schedules")
    if (!res.ok) throw new Error("Caricamento schedulazioni non riuscito")
    setSchedules((await res.json()) as Schedule[])
  }

  useEffect(() => {
    let active = true
    let inFlight = false
    const pollJobs = () => {
      if (inFlight) return
      inFlight = true
      fetch("/api/admin/jobs")
        .then((res) => {
          if (!res.ok) throw new Error("Caricamento operazioni non riuscito")
          return res.json() as Promise<{ jobs: Job[]; types: JobType[] }>
        })
        .then((data) => {
          if (!active) return
          setJobs(data.jobs)
          setTypes(data.types)
          setSelectedType((prev) => prev || data.types[0]?.type || "")
          setLoading(false)
        })
        .catch(() => {
          if (active) setLoading(false)
        })
        .finally(() => {
          inFlight = false
        })
    }
    pollJobs()
    fetch("/api/admin/jobs/schedules")
      .then((res) => (res.ok ? (res.json() as Promise<Schedule[]>) : []))
      .then((data) => {
        if (active) setSchedules(data)
      })
      .catch(() => {})
    const id = setInterval(pollJobs, POLL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  function setField(name: string, value: string | number | boolean) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await Promise.all([reloadJobs(), reloadSchedules()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aggiornamento non riuscito")
    } finally {
      setRefreshing(false)
    }
  }

  async function handleStart() {
    if (!selectedType) return
    setStarting(true)
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          payload: buildPayload(fields, values),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? "Avvio non riuscito")
      }
      toast.success("Operazione avviata")
      await reloadJobs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Avvio non riuscito")
    } finally {
      setStarting(false)
    }
  }

  async function handleSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setScheduling(true)
    try {
      const res = await fetch("/api/admin/jobs/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          payload: buildPayload(fields, values),
          cron,
          tz,
          name: scheduleName.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? "Schedulazione non riuscita")
      }
      setSchedules((await res.json()) as Schedule[])
      toast.success("Schedulazione creata")
      setScheduleOpen(false)
      setScheduleName("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Schedulazione non riuscita")
    } finally {
      setScheduling(false)
    }
  }

  async function handleCancel(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/jobs/${id}/cancel`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Stop non riuscito")
      toast.success("Stop richiesto")
      await reloadJobs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stop non riuscito")
    } finally {
      setBusyId(null)
    }
  }

  async function handleRunNow(key: string) {
    setBusyKey(key)
    try {
      const res = await fetch(
        `/api/admin/jobs/schedules/${encodeURIComponent(key)}/run`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("Avvio non riuscito")
      toast.success("Esecuzione avviata")
      await reloadJobs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Avvio non riuscito")
    } finally {
      setBusyKey(null)
    }
  }

  async function handleUnschedule(key: string) {
    setBusyKey(key)
    try {
      const res = await fetch(
        `/api/admin/jobs/schedules/${encodeURIComponent(key)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Rimozione non riuscita")
      toast.success("Schedulazione rimossa")
      await reloadSchedules()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rimozione non riuscita")
    } finally {
      setBusyKey(null)
    }
  }

  const labelFor = (type: string) =>
    types.find((t) => t.type === type)?.label ?? type

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Operazioni</CardTitle>
          <CardDescription>
            Scegli un&apos;operazione, compila i dati, poi avviala subito o
            schedulala. Le esecuzioni compaiono nella tabella in basso.
          </CardDescription>
          <CardAction>
            <IconTip label="Aggiorna">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Aggiorna"
                disabled={refreshing}
                onClick={handleRefresh}
              >
                <RefreshCwIcon
                  className={refreshing ? "animate-spin" : undefined}
                />
              </Button>
            </IconTip>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={selectedType}
              onValueChange={setSelectedType}
              disabled={starting || types.length === 0}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Scegli un'operazione…" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.type} value={t.type}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleStart} disabled={starting || !selectedType}>
              {starting ? <Spinner /> : <PlayIcon data-icon="inline-start" />}
              Avvia
            </Button>
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!selectedType}>
                  <CalendarClockIcon data-icon="inline-start" />
                  Schedula…
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedula «{labelFor(selectedType)}»</DialogTitle>
                  <DialogDescription>
                    Usa i dati compilati sopra. Scegli quando ripetere
                    l&apos;operazione.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSchedule} className="flex flex-col gap-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="s-name">Nome</FieldLabel>
                      <Input
                        id="s-name"
                        placeholder="es. nota-giornaliera"
                        required
                        value={scheduleName}
                        onChange={(e) => setScheduleName(e.target.value)}
                        disabled={scheduling}
                      />
                    </Field>
                    <CronBuilder
                      freq={freq}
                      onFreq={setFreq}
                      everyN={everyN}
                      onEveryN={setEveryN}
                      atMinute={atMinute}
                      onAtMinute={setAtMinute}
                      time={time}
                      onTime={setTime}
                      weekday={weekday}
                      onWeekday={setWeekday}
                      dom={dom}
                      onDom={setDom}
                      tz={tz}
                      onTz={setTz}
                      cron={cron}
                      disabled={scheduling}
                    />
                  </FieldGroup>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={scheduling}
                      >
                        Annulla
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={scheduling}>
                      {scheduling && <Spinner />}
                      Schedula
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Maschera dei dati generata dal tipo selezionato, in un accordion
              chiuso di default. */}
          {fields.length > 0 && (
            <Accordion
              type="single"
              collapsible
              className="rounded-lg border px-4"
            >
              <AccordionItem value="dati" className="border-b-0">
                <AccordionTrigger>
                  Dati ({fields.length}{" "}
                  {fields.length === 1 ? "campo" : "campi"})
                </AccordionTrigger>
                {/* px-1: lascia spazio al focus ring (3px) degli input, che
                    altrimenti verrebbe tagliato dall'overflow-hidden del
                    contenuto dell'accordion. */}
                <AccordionContent className="px-1">
                  <FieldGroup>
                    {fields.map((f) => (
                      <JobFieldInput
                        key={f.name}
                        field={f}
                        value={fieldValue(values, f)}
                        onChange={(v) => setField(f.name, v)}
                      />
                    ))}
                  </FieldGroup>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner /> Caricamento…
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operazione</TableHead>
                    <TableHead className="w-32">Stato</TableHead>
                    <TableHead className="w-64">Avanzamento</TableHead>
                    <TableHead className="w-px text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Nessuna operazione. Avviane una qui sopra.
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => {
                      const meta = STATUS_META[job.status]
                      return (
                        <TableRow key={job.id}>
                          <TableCell>
                            <div className="flex min-w-0 flex-col">
                              <span className="font-medium">
                                {labelFor(job.type)}
                              </span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {fmt(job.createdAt)}
                                {job.scheduleKey
                                  ? ` · cron: ${job.scheduleKey}`
                                  : ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {job.status === "running" || job.progress > 0 ? (
                              <div className="flex flex-col gap-1">
                                <Progress value={job.progress} />
                                <span className="truncate text-xs text-muted-foreground tabular-nums">
                                  {job.progress}%
                                  {job.message ? ` · ${job.message}` : ""}
                                </span>
                              </div>
                            ) : job.error ? (
                              <span className="truncate text-xs text-destructive">
                                {job.error}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <JobLogsDialog
                                job={job}
                                label={labelFor(job.type)}
                              />
                              {isActive(job.status) && (
                                <ConfirmIconButton
                                  icon={<SquareIcon className="fill-current" />}
                                  label={
                                    job.cancelRequested ? "Arresto…" : "Ferma"
                                  }
                                  disabled={
                                    busyId === job.id || job.cancelRequested
                                  }
                                  busy={
                                    busyId === job.id || job.cancelRequested
                                  }
                                  destructive
                                  title="Fermare l'operazione?"
                                  description="Verrà richiesto l'arresto al worker appena possibile. Il lavoro già svolto non viene annullato."
                                  confirmLabel="Ferma"
                                  onConfirm={() => handleCancel(job.id)}
                                />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedulazioni</CardTitle>
          <CardDescription>
            Operazioni ricorrenti. Allo scattare dell&apos;orario accodano
            un&apos;esecuzione (visibile nella tabella qui sopra).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Operazione</TableHead>
                  <TableHead>Pianificazione</TableHead>
                  <TableHead className="w-44">Ultima</TableHead>
                  <TableHead className="w-36">Prossima</TableHead>
                  <TableHead className="w-px text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-20 text-center text-muted-foreground"
                    >
                      Nessuna schedulazione. Creane una con «Schedula…».
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((s) => (
                    <TableRow key={s.key}>
                      <TableCell className="font-medium">{s.key}</TableCell>
                      <TableCell>{labelFor(s.type)}</TableCell>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span>{s.human ?? s.cron}</span>
                          <span className="text-xs text-muted-foreground">
                            {s.timezone || "UTC"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.lastRun ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              variant={STATUS_META[s.lastRun.status].variant}
                            >
                              {STATUS_META[s.lastRun.status].label}
                            </Badge>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {fmt(s.lastRun.at)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            mai
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {s.nextRun ? fmt(s.nextRun) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <ConfirmIconButton
                            icon={<PlayIcon />}
                            label="Esegui ora"
                            disabled={busyKey === s.key}
                            busy={busyKey === s.key}
                            title="Eseguire adesso?"
                            description={`Accoda subito un'esecuzione di «${labelFor(s.type)}», senza attendere l'orario pianificato.`}
                            confirmLabel="Esegui ora"
                            onConfirm={() => handleRunNow(s.key)}
                          />
                          <ConfirmIconButton
                            icon={<Trash2Icon />}
                            label="Elimina"
                            disabled={busyKey === s.key}
                            busy={busyKey === s.key}
                            destructive
                            title="Eliminare la schedulazione?"
                            description={`«${s.key}» non verrà più eseguita automaticamente. Le esecuzioni già avviate non vengono toccate.`}
                            confirmLabel="Elimina"
                            onConfirm={() => handleUnschedule(s.key)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Form generato dalla maschera -------------------------------------------
function JobFieldInput({
  field,
  value,
  onChange,
}: {
  field: JobField
  value: string | number | boolean
  onChange: (v: string | number | boolean) => void
}) {
  const id = `f-${field.name}`
  if (field.type === "boolean") {
    return (
      <Field orientation="horizontal">
        <Checkbox
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(c) => onChange(c === true)}
        />
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      </Field>
    )
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      {field.type === "textarea" ? (
        <Textarea
          id={id}
          rows={3}
          required={field.required}
          placeholder={field.placeholder}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" ? (
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : "text"}
          required={field.required}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.help && (
        <span className="text-xs text-muted-foreground">{field.help}</span>
      )}
    </Field>
  )
}

// --- Cron builder a preset ---------------------------------------------------
type Freq = "minuti" | "ora" | "giorno" | "settimana" | "mese"

const WEEKDAYS = [
  { value: "1", label: "Lunedì" },
  { value: "2", label: "Martedì" },
  { value: "3", label: "Mercoledì" },
  { value: "4", label: "Giovedì" },
  { value: "5", label: "Venerdì" },
  { value: "6", label: "Sabato" },
  { value: "0", label: "Domenica" },
]

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isNaN(n) ? lo : n))

// Genera l'espressione cron (5 campi) dai parametri guidati.
function buildCron(s: {
  freq: Freq
  everyN: number
  atMinute: number
  time: string
  weekday: string
  dom: number
}): string {
  const [h, m] = s.time.split(":").map((x) => clamp(Number(x), 0, 59))
  switch (s.freq) {
    case "minuti":
      return `*/${clamp(s.everyN, 1, 59)} * * * *`
    case "ora":
      return `${clamp(s.atMinute, 0, 59)} * * * *`
    case "giorno":
      return `${m} ${h} * * *`
    case "settimana":
      return `${m} ${h} * * ${s.weekday}`
    case "mese":
      return `${m} ${h} ${clamp(s.dom, 1, 31)} * *`
  }
}

function cronPreview(cron: string): string {
  try {
    return cronstrue.toString(cron, { locale: "it", use24HourTimeFormat: true })
  } catch {
    return cron
  }
}

function CronBuilder(props: {
  freq: Freq
  onFreq: (v: Freq) => void
  everyN: number
  onEveryN: (v: number) => void
  atMinute: number
  onAtMinute: (v: number) => void
  time: string
  onTime: (v: string) => void
  weekday: string
  onWeekday: (v: string) => void
  dom: number
  onDom: (v: number) => void
  tz: string
  onTz: (v: string) => void
  cron: string
  disabled?: boolean
}) {
  return (
    <>
      <Field>
        <FieldLabel>Frequenza</FieldLabel>
        <Select
          value={props.freq}
          onValueChange={(v) => props.onFreq(v as Freq)}
          disabled={props.disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minuti">Ogni N minuti</SelectItem>
            <SelectItem value="ora">Ogni ora</SelectItem>
            <SelectItem value="giorno">Ogni giorno</SelectItem>
            <SelectItem value="settimana">Ogni settimana</SelectItem>
            <SelectItem value="mese">Ogni mese</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {props.freq === "minuti" && (
        <Field>
          <FieldLabel htmlFor="cb-n">Ogni quanti minuti</FieldLabel>
          <Input
            id="cb-n"
            type="number"
            min={1}
            max={59}
            value={props.everyN}
            onChange={(e) => props.onEveryN(Number(e.target.value))}
            disabled={props.disabled}
          />
        </Field>
      )}

      {props.freq === "ora" && (
        <Field>
          <FieldLabel htmlFor="cb-m">Al minuto</FieldLabel>
          <Input
            id="cb-m"
            type="number"
            min={0}
            max={59}
            value={props.atMinute}
            onChange={(e) => props.onAtMinute(Number(e.target.value))}
            disabled={props.disabled}
          />
        </Field>
      )}

      {props.freq === "settimana" && (
        <Field>
          <FieldLabel>Giorno della settimana</FieldLabel>
          <Select
            value={props.weekday}
            onValueChange={props.onWeekday}
            disabled={props.disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {props.freq === "mese" && (
        <Field>
          <FieldLabel htmlFor="cb-dom">Giorno del mese</FieldLabel>
          <Input
            id="cb-dom"
            type="number"
            min={1}
            max={31}
            value={props.dom}
            onChange={(e) => props.onDom(Number(e.target.value))}
            disabled={props.disabled}
          />
        </Field>
      )}

      {(props.freq === "giorno" ||
        props.freq === "settimana" ||
        props.freq === "mese") && (
        <Field>
          <FieldLabel htmlFor="cb-time">Orario</FieldLabel>
          <Input
            id="cb-time"
            type="time"
            value={props.time}
            onChange={(e) => props.onTime(e.target.value)}
            disabled={props.disabled}
          />
        </Field>
      )}

      <Field>
        <FieldLabel>Fuso orario</FieldLabel>
        <Select
          value={props.tz}
          onValueChange={props.onTz}
          disabled={props.disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">
        {cronPreview(props.cron)}{" "}
        <span className="text-muted-foreground">· {props.tz}</span>
      </p>
    </>
  )
}

// Wrapper: associa un tooltip a un trigger icona (il bottone resta il figlio,
// così funziona anche come trigger di Dialog/AlertDialog tramite asChild).
function IconTip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// Azione di tabella: bottone solo-icona con tooltip e conferma (AlertDialog).
// Le azioni con effetti (esegui, ferma, elimina) passano sempre da qui.
function ConfirmIconButton({
  icon,
  label,
  disabled,
  busy,
  destructive,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  icon: React.ReactNode
  label: string
  disabled?: boolean
  busy?: boolean
  destructive?: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <IconTip label={label}>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
            className={
              destructive
                ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                : undefined
            }
          >
            {busy ? <Spinner /> : icon}
          </Button>
        </AlertDialogTrigger>
      </IconTip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function JobLogsDialog({ job, label }: { job: Job; label: string }) {
  return (
    <Dialog>
      <IconTip label="Log">
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Log">
            <FileTextIcon />
          </Button>
        </DialogTrigger>
      </IconTip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Job {job.id} · stato {STATUS_META[job.status].label.toLowerCase()}
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
          {job.logs.length > 0 ? job.logs.join("\n") : "Nessun log."}
          {job.error ? `\n\nERRORE: ${job.error}` : ""}
        </pre>
      </DialogContent>
    </Dialog>
  )
}
