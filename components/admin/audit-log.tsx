"use client"

import { useEffect, useMemo, useState } from "react"
import { InfoIcon, RefreshCwIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  actionLabel,
  auditCatalog,
  auditCategories,
  categoryLabel,
} from "@/lib/audit/catalog"

// Tipi allineati a lib/audit (AuditLogView).
type AuditTarget = { type: string; id?: string; label?: string }
type Entry = {
  id: string
  action: string
  actionLabel: string
  category: string
  outcome: "success" | "failure"
  actorId: string | null
  actorEmail: string | null
  target: AuditTarget | null
  metadata: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

const PAGE_SIZE = 50
const ALL = "all" // sentinella "nessun filtro" per i Select

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "medium",
  })

export function AuditLog() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filtri.
  const [category, setCategory] = useState(ALL)
  const [action, setAction] = useState(ALL)
  const [outcome, setOutcome] = useState(ALL)
  const [actor, setActor] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [offset, setOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  // Azioni selezionabili: filtrate per categoria, se scelta.
  const actionOptions = useMemo(
    () =>
      auditCatalog.filter((e) => category === ALL || e.category === category),
    [category]
  )

  const hasFilters =
    category !== ALL ||
    action !== ALL ||
    outcome !== ALL ||
    actor !== "" ||
    from !== "" ||
    to !== ""

  // Carica con debounce (per il campo attore di testo).
  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (category !== ALL) params.set("category", category)
    if (action !== ALL) params.set("action", action)
    if (outcome !== ALL) params.set("outcome", outcome)
    if (actor.trim()) params.set("actor", actor.trim())
    if (from) params.set("from", new Date(from).toISOString())
    if (to) params.set("to", new Date(to).toISOString())
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(offset))

    const timer = setTimeout(() => {
      fetch(`/api/admin/audit?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error("Caricamento del registro non riuscito")
          return res.json() as Promise<{ entries: Entry[]; total: number }>
        })
        .then((data) => {
          if (!active) return
          setEntries(data.entries)
          setTotal(data.total)
          setLoading(false)
        })
        .catch((e) => {
          if (!active) return
          setLoading(false)
          toast.error(e instanceof Error ? e.message : "Errore imprevisto")
        })
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [category, action, outcome, actor, from, to, offset, reloadKey])

  // Cambiare un filtro riporta alla prima pagina.
  function resetToFirstPage() {
    setOffset(0)
  }

  function clearFilters() {
    setCategory(ALL)
    setAction(ALL)
    setOutcome(ALL)
    setActor("")
    setFrom("")
    setTo("")
    setOffset(0)
  }

  function handleRefresh() {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
    // Lo spinner si spegne al prossimo render con i dati; piccola finestra.
    setTimeout(() => setRefreshing(false), 400)
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro</CardTitle>
        <CardDescription>
          Eventi dal più recente. Usa i filtri per restringere la ricerca.
        </CardDescription>
        <CardAction>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Aggiorna"
                disabled={refreshing}
                onClick={handleRefresh}
              >
                <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aggiorna</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Filtri */}
        <div className="flex flex-wrap items-end gap-3">
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v)
              setAction(ALL)
              resetToFirstPage()
            }}
          >
            <SelectTrigger className="w-44" aria-label="Categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tutte le categorie</SelectItem>
              {auditCategories.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v)
              resetToFirstPage()
            }}
          >
            <SelectTrigger className="w-56" aria-label="Evento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tutti gli eventi</SelectItem>
              {actionOptions.map((e) => (
                <SelectItem key={e.action} value={e.action}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={outcome}
            onValueChange={(v) => {
              setOutcome(v)
              resetToFirstPage()
            }}
          >
            <SelectTrigger className="w-36" aria-label="Esito">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Ogni esito</SelectItem>
              <SelectItem value="success">Successo</SelectItem>
              <SelectItem value="failure">Fallimento</SelectItem>
            </SelectContent>
          </Select>

          <Input
            className="w-52"
            placeholder="Attore (email o id)"
            aria-label="Attore"
            value={actor}
            onChange={(e) => {
              setActor(e.target.value)
              resetToFirstPage()
            }}
          />

          <Input
            type="date"
            className="w-40 tabular-nums"
            aria-label="Da"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              resetToFirstPage()
            }}
          />
          <Input
            type="date"
            className="w-40 tabular-nums"
            aria-label="A"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              resetToFirstPage()
            }}
          />

          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <XIcon data-icon="inline-start" />
              Azzera filtri
            </Button>
          )}
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
                  <TableHead className="w-44">Quando</TableHead>
                  <TableHead>Attore</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead className="w-28">Esito</TableHead>
                  <TableHead className="w-32">IP</TableHead>
                  <TableHead className="w-px text-right">Dettagli</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nessun evento per questi filtri.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {fmt(e.createdAt)}
                      </TableCell>
                      <TableCell>
                        {e.actorEmail || e.actorId ? (
                          <span className="text-sm">
                            {e.actorEmail ?? e.actorId}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            anonimo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{e.actionLabel}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {e.action}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            e.outcome === "failure" ? "destructive" : "outline"
                          }
                        >
                          {e.outcome === "failure" ? "Fallito" : "OK"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {e.ip ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <AuditDetailsDialog entry={e} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginazione */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground tabular-nums">
            {total} event{total === 1 ? "o" : "i"}
            {total > 0 ? ` · pagina ${page} di ${pages}` : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Precedente
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Successiva
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Dettaglio di una riga: target, metadati, user-agent, timestamp completo.
function AuditDetailsDialog({ entry }: { entry: Entry }) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Dettagli">
              <InfoIcon />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Dettagli</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{actionLabel(entry.action)}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {entry.action}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Quando</dt>
          <dd className="tabular-nums">{fmt(entry.createdAt)}</dd>
          <dt className="text-muted-foreground">Attore</dt>
          <dd>{entry.actorEmail ?? entry.actorId ?? "anonimo"}</dd>
          <dt className="text-muted-foreground">Esito</dt>
          <dd>{entry.outcome === "failure" ? "Fallito" : "Successo"}</dd>
          <dt className="text-muted-foreground">IP</dt>
          <dd className="tabular-nums">{entry.ip ?? "—"}</dd>
          {entry.target && (
            <>
              <dt className="text-muted-foreground">Target</dt>
              <dd className="break-all">
                {entry.target.label ?? entry.target.id ?? entry.target.type}
                <span className="text-muted-foreground"> ({entry.target.type})</span>
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">User-agent</dt>
          <dd className="break-all text-xs text-muted-foreground">
            {entry.userAgent ?? "—"}
          </dd>
        </dl>
        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
          <pre className="max-h-60 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  )
}
