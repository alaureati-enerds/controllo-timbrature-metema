"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PlayIcon, RefreshCwIcon } from "lucide-react"
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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

// Intervallo di polling: la UI ricarica la lista per seguire avanzamento e
// stato. È l'approccio più semplice e robusto; in futuro si può passare a SSE
// senza toccare API o modello.
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

export function JobsManager() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [types, setTypes] = useState<JobType[]>([])
  const [selectedType, setSelectedType] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Evita che due fetch di polling si accavallino.
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch("/api/admin/jobs")
      if (!res.ok) throw new Error("Caricamento non riuscito")
      const data = (await res.json()) as { jobs: Job[]; types: JobType[] }
      setJobs(data.jobs)
      setTypes(data.types)
      setSelectedType((prev) => prev || data.types[0]?.type || "")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore di rete")
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  // Carica all'avvio e poi in polling finché la pagina è aperta. Lo stato si
  // aggiorna SOLO nelle callback asincrone (.then/.catch), mai in modo sincrono
  // nel corpo dell'effetto.
  useEffect(() => {
    let active = true
    const poll = () => {
      if (inFlight.current) return
      inFlight.current = true
      fetch("/api/admin/jobs")
        .then((res) => {
          if (!res.ok) throw new Error("Caricamento non riuscito")
          return res.json() as Promise<{ jobs: Job[]; types: JobType[] }>
        })
        .then((data) => {
          if (!active) return
          setJobs(data.jobs)
          setTypes(data.types)
          setSelectedType((prev) => prev || data.types[0]?.type || "")
          setLoading(false)
        })
        .catch((e) => {
          if (!active) return
          setLoading(false)
          toast.error(e instanceof Error ? e.message : "Errore di rete")
        })
        .finally(() => {
          inFlight.current = false
        })
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  async function handleStart() {
    if (!selectedType) return
    setStarting(true)
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? "Avvio non riuscito")
      }
      toast.success("Operazione avviata")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Avvio non riuscito")
    } finally {
      setStarting(false)
    }
  }

  async function handleCancel(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/jobs/${id}/cancel`, { method: "POST" })
      if (!res.ok) throw new Error("Stop non riuscito")
      toast.success("Stop richiesto")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stop non riuscito")
    } finally {
      setBusyId(null)
    }
  }

  const labelFor = (type: string) =>
    types.find((t) => t.type === type)?.label ?? type

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operazioni</CardTitle>
        <CardDescription>
          Avvia un&apos;operazione in background e seguine l&apos;andamento. Le
          operazioni schedulate compaiono qui automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
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
          </div>
          <Button variant="outline" onClick={() => load()}>
            <RefreshCwIcon data-icon="inline-start" />
            Aggiorna
          </Button>
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
          {job.logs.length > 0
            ? job.logs.join("\n")
            : "Nessun log."}
          {job.error ? `\n\nERRORE: ${job.error}` : ""}
        </pre>
      </DialogContent>
    </Dialog>
  )
}
