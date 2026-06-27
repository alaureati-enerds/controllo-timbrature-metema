"use client"

import { useEffect, useState } from "react"
import { CalendarClockIcon, PlayIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
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

// Stati allineati a JobStatus (prisma/schema.prisma, lib/jobs).
type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

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
  startedAt: string | null
  finishedAt: string | null
}

type JobType = { type: string; label: string }
type Schedule = {
  key: string
  type: string
  cron: string
  timezone: string
  payload: unknown
}

// Polling della lista job: l'approccio più semplice e robusto per seguire
// l'avanzamento; le schedulazioni cambiano di rado e si ricaricano a parte.
const POLL_MS = 1500

const STATUS_META: Record<
  JobStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  queued: { label: "In coda", variant: "secondary" },
  running: { label: "In esecuzione", variant: "default" },
  completed: { label: "Completato", variant: "outline" },
  failed: { label: "Fallito", variant: "destructive" },
  cancelled: { label: "Annullato", variant: "outline" },
}

const isActive = (s: JobStatus) => s === "queued" || s === "running"

// Interpreta il payload JSON facoltativo digitato nei form. Stringa vuota →
// nessun payload; JSON non valido → eccezione (gestita dal chiamante).
function parsePayload(text: string): Record<string, unknown> | undefined {
  const t = text.trim()
  if (!t) return undefined
  const parsed = JSON.parse(t)
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Il payload deve essere un oggetto JSON")
  }
  return parsed as Record<string, unknown>
}

export function JobsManager() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [types, setTypes] = useState<JobType[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedType, setSelectedType] = useState<string>("")
  const [payloadText, setPayloadText] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  // Schedulazione: dialog e campi.
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleName, setScheduleName] = useState("")
  const [cron, setCron] = useState("0 3 * * *")
  const [scheduling, setScheduling] = useState(false)

  // Carica job e schedulazioni in modo imperativo (usato da azioni e refresh).
  // Lo stato si aggiorna solo nelle callback asincrone.
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

  // Carico tutto all'avvio e poi i job in polling finché la pagina è aperta.
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

  async function handleStart() {
    if (!selectedType) return
    setStarting(true)
    try {
      const payload = parsePayload(payloadText)
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType, payload }),
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
      const payload = parsePayload(payloadText)
      const res = await fetch("/api/admin/jobs/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          payload,
          cron,
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
      const res = await fetch(`/api/admin/jobs/${id}/cancel`, { method: "POST" })
      if (!res.ok) throw new Error("Stop non riuscito")
      toast.success("Stop richiesto")
      await reloadJobs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stop non riuscito")
    } finally {
      setBusyId(null)
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
            Avvia subito un&apos;operazione o schedulala. Le esecuzioni
            (manuali e da cron) compaiono nella tabella in basso.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
                <ScheduleDialog
                  open={scheduleOpen}
                  onOpenChange={setScheduleOpen}
                  disabled={!selectedType}
                  name={scheduleName}
                  onName={setScheduleName}
                  cron={cron}
                  onCron={setCron}
                  scheduling={scheduling}
                  onSubmit={handleSchedule}
                  typeLabel={labelFor(selectedType)}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  void reloadJobs()
                  void reloadSchedules()
                }}
              >
                <RefreshCwIcon data-icon="inline-start" />
                Aggiorna
              </Button>
            </div>

            {/* Payload condiviso da "Avvia" e "Schedula". Per "Crea una nota":
                {"text": "La mia nota"} — l'utente proprietario è impostato dal
                server. Per l'operazione demo può restare vuoto. */}
            <Field>
              <FieldLabel htmlFor="payload">Dati (JSON, opzionale)</FieldLabel>
              <Textarea
                id="payload"
                rows={3}
                spellCheck={false}
                placeholder='Es. {"text": "La mia nota"}'
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
          </div>

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
                              <span className="text-xs text-muted-foreground">
                                {new Date(job.createdAt).toLocaleString("it-IT")}
                                {job.scheduleKey ? ` · cron: ${job.scheduleKey}` : ""}
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
                                <span className="truncate text-xs text-muted-foreground">
                                  {job.progress}%
                                  {job.message ? ` · ${job.message}` : ""}
                                </span>
                              </div>
                            ) : job.error ? (
                              <span className="truncate text-xs text-destructive">
                                {job.error}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <JobLogsDialog job={job} label={labelFor(job.type)} />
                              {isActive(job.status) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busyId === job.id || job.cancelRequested}
                                  onClick={() => handleCancel(job.id)}
                                >
                                  {job.cancelRequested ? "Arresto…" : "Stop"}
                                </Button>
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
            Operazioni ricorrenti (cron). Allo scattare dell&apos;orario accodano
            un&apos;esecuzione, visibile nella tabella qui sopra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Operazione</TableHead>
                  <TableHead className="w-40">Cron</TableHead>
                  <TableHead className="w-28">Fuso</TableHead>
                  <TableHead className="w-px text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
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
                      <TableCell className="font-mono text-xs">{s.cron}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.timezone || "UTC"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyKey === s.key}
                            onClick={() => handleUnschedule(s.key)}
                          >
                            <Trash2Icon data-icon="inline-start" />
                            Elimina
                          </Button>
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

function ScheduleDialog({
  open,
  onOpenChange,
  disabled,
  name,
  onName,
  cron,
  onCron,
  scheduling,
  onSubmit,
  typeLabel,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  disabled: boolean
  name: string
  onName: (v: string) => void
  cron: string
  onCron: (v: string) => void
  scheduling: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  typeLabel: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <CalendarClockIcon data-icon="inline-start" />
          Schedula…
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedula «{typeLabel}»</DialogTitle>
          <DialogDescription>
            Usa il tipo e i dati (JSON) selezionati sopra. L&apos;orario è in
            sintassi cron a 5 campi (UTC).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="s-name">Nome</FieldLabel>
              <Input
                id="s-name"
                placeholder="es. nota-giornaliera"
                required
                value={name}
                onChange={(e) => onName(e.target.value)}
                disabled={scheduling}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="s-cron">Cron</FieldLabel>
              <Input
                id="s-cron"
                className="font-mono"
                placeholder="0 3 * * *"
                required
                value={cron}
                onChange={(e) => onCron(e.target.value)}
                disabled={scheduling}
              />
              <span className="text-xs text-muted-foreground">
                Esempi: «0 3 * * *» ogni giorno alle 03:00 · «*/15 * * * *» ogni
                15 minuti · «30 9 * * 1» lunedì alle 09:30.
              </span>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={scheduling}>
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
  )
}

function JobLogsDialog({ job, label }: { job: Job; label: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Log
        </Button>
      </DialogTrigger>
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
