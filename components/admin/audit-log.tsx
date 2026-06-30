"use client"

import { useEffect, useMemo, useState } from "react"
import { endOfDay, format, startOfDay } from "date-fns"
import { it } from "date-fns/locale"
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  InfoIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Skeleton } from "@/components/ui/skeleton"
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
  const [from, setFrom] = useState<Date>()
  const [to, setTo] = useState<Date>()
  const [offset, setOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  // State filtro mobile (Sheet controllato).
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

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
    from !== undefined ||
    to !== undefined

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (category !== ALL) count++
    if (action !== ALL) count++
    if (outcome !== ALL) count++
    if (actor !== "") count++
    if (from !== undefined) count++
    if (to !== undefined) count++
    return count
  }, [category, action, outcome, actor, from, to])

  // Carica con debounce (per il campo attore di testo).
  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (category !== ALL) params.set("category", category)
    if (action !== ALL) params.set("action", action)
    if (outcome !== ALL) params.set("outcome", outcome)
    if (actor.trim()) params.set("actor", actor.trim())
    if (from) params.set("from", startOfDay(from).toISOString())
    if (to) params.set("to", endOfDay(to).toISOString())
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
    setFrom(undefined)
    setTo(undefined)
    setOffset(0)
    setMobileFilterOpen(false)
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
                <RefreshCwIcon
                  className={refreshing ? "animate-spin" : undefined}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aggiorna</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Desktop — filtri in linea */}
        <div className="hidden flex-wrap items-end gap-3 md:flex">
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

          <DateFilter
            label="Da"
            value={from}
            onChange={(d) => {
              setFrom(d)
              resetToFirstPage()
            }}
          />
          <DateFilter
            label="A"
            value={to}
            onChange={(d) => {
              setTo(d)
              resetToFirstPage()
            }}
          />

          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} aria-label="Azzera filtri">
              <XIcon data-icon="inline-start" />
              Azzera filtri
            </Button>
          )}
        </div>

        {/* Mobile — Sheet filtri */}
        <div className="flex gap-2 md:hidden">
          <Drawer open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" className="flex-1">
                <FilterIcon data-icon="inline-start" />
                Filtri
                {hasFilters && (
                  <Badge variant="secondary" className="ml-auto">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="px-5 pt-4 pb-4 text-left">
                <div className="flex items-center justify-between">
                  <DrawerTitle className="flex items-center gap-2">
                    <FilterIcon className="size-4" />
                    Filtri
                  </DrawerTitle>
                  {hasFilters && (
                    <Button variant="ghost" onClick={clearFilters} size="sm" aria-label="Azzera filtri">
                      <XIcon className="size-4" />
                      Azzera
                    </Button>
                  )}
                </div>
              </DrawerHeader>
              <div
                className="no-scrollbar overflow-y-auto"
                style={{
                  paddingLeft: "calc(1.25rem + env(safe-area-inset-left))",
                  paddingRight: "calc(1.25rem + env(safe-area-inset-right))",
                  paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
                }}
              >
                <div className="flex flex-col gap-4">
                  <Select
                  value={category}
                  onValueChange={(v) => {
                    setCategory(v)
                    setAction(ALL)
                    resetToFirstPage()
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Categoria">
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
                  <SelectTrigger className="w-full" aria-label="Evento">
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
                  <SelectTrigger className="w-full" aria-label="Esito">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Ogni esito</SelectItem>
                    <SelectItem value="success">Successo</SelectItem>
                    <SelectItem value="failure">Fallimento</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Attore (email o id)"
                  aria-label="Attore"
                  value={actor}
                  onChange={(e) => {
                    setActor(e.target.value)
                    resetToFirstPage()
                  }}
                />

                <div className="flex gap-3">
                  <div className="flex-1">
                    <DateFilter
                      label="Da"
                      value={from}
                      onChange={(d) => {
                        setFrom(d)
                        resetToFirstPage()
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <DateFilter
                      label="A"
                      value={to}
                      onChange={(d) => {
                        setTo(d)
                        resetToFirstPage()
                      }}
                    />
                  </div>
                </div>
              </div>
              </div>
            </DrawerContent>
          </Drawer>
          {hasFilters && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Azzera filtri"
              onClick={clearFilters}
            >
              <XIcon />
            </Button>
          )}
        </div>

        {/* Desktop — tabella */}
        <div className="hidden overflow-hidden rounded-lg border md:block">
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
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 p-0">
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <InfoIcon />
                        </EmptyMedia>
                        <EmptyTitle>Nessun evento</EmptyTitle>
                        <EmptyDescription>
                          Nessun evento corrisponde a questi filtri. Prova ad
                          allargare l&apos;intervallo o ad azzerare i filtri.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
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

        {/* Mobile — card list */}
        <div className="flex flex-col gap-3 md:hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} size="sm">
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </CardContent>
              </Card>
            ))
          ) : entries.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <InfoIcon />
                </EmptyMedia>
                <EmptyTitle>Nessun evento</EmptyTitle>
                <EmptyDescription>
                  Nessun evento corrisponde a questi filtri. Prova ad
                  allargare l&apos;intervallo o ad azzerare i filtri.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            entries.map((e) => (
              <Card key={e.id} size="sm">
                <CardContent>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge
                        variant={
                          e.outcome === "failure" ? "destructive" : "outline"
                        }
                        className="shrink-0"
                      >
                        {e.outcome === "failure" ? "Fallito" : "OK"}
                      </Badge>
                      <div className="text-sm font-medium">
                        {e.actionLabel}
                      </div>
                    </div>
                    <AuditDetailsDialog entry={e} />
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="font-mono">{e.action}</div>
                    <div className="tabular-nums">{fmt(e.createdAt)}</div>
                    <div>
                      {e.actorEmail ?? e.actorId ?? "anonimo"}
                    </div>
                    <div className="tabular-nums">{e.ip ?? "—"}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

      </CardContent>
      <CardFooter className="flex-col items-center gap-3 md:flex-row md:justify-between">
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
            <ChevronLeftIcon data-icon="inline-start" />
            Precedente
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Successiva
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

// Filtro per data: bottone-trigger con Popover + Calendar (sostituisce l'input
// date nativo, per coerenza con la UI shadcn). Il calendario è in italiano.
function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: Date | undefined
  onChange: (date: Date | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={label}
          data-empty={!value}
          className="w-full justify-start font-normal tabular-nums data-[empty=true]:text-muted-foreground md:w-40"
        >
          <CalendarIcon data-icon="inline-start" />
          {value ? format(value, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={it}
          selected={value}
          onSelect={(d) => {
            onChange(d)
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
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
                <span className="text-muted-foreground">
                  {" "}
                  ({entry.target.type})
                </span>
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">User-agent</dt>
          <dd className="text-xs break-all text-muted-foreground">
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
