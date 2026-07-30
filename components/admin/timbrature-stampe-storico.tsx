"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  EyeIcon,
  FileArchiveIcon,
  FilterIcon,
  InfoIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { MESI } from "@/components/admin/selettore-periodo"
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getStampaTemplate,
  isStampaTemplateId,
} from "@/lib/timbrature/stampa/catalog"

// Storico delle stampe già generate: uno SNAPSHOT per riga (il PDF esatto
// prodotto in quel momento, non ricalcolato). Stesso pattern collaudato di
// AuditLog (components/admin/audit-log.tsx): filtri in linea su desktop,
// Drawer su mobile, tabella + card list, paginazione, più selezione multipla
// per le azioni massive (ZIP, eliminazione). Vedi lib/timbrature/stampe-storico.ts.

type Entry = {
  id: string
  originalName: string
  size: number
  dipendente: string | null
  dipendenteLabel: string | null
  cumulativo: boolean
  mese: number
  anno: number
  templateId: string
  actorEmail: string | null
  actorId: string | null
  createdAt: string
}

const PAGE_SIZE = 50
const ALL = "all" // sentinella "nessun filtro" per i Select

const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  })

const annoCorrente = new Date().getFullYear()
const ANNI = Array.from({ length: 5 }, (_, i) => annoCorrente - i)

function templateNome(id: string): string {
  return isStampaTemplateId(id) ? getStampaTemplate(id).nome : id
}

function dipendenteLabel(e: Entry): string {
  return e.cumulativo ? "Tutti i dipendenti" : (e.dipendenteLabel ?? e.dipendente ?? "—")
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  return data?.error ?? "Operazione non riuscita"
}

/** Scarica un blob già ottenuto forzando il nome file, senza navigare via. */
function scaricaBlob(blob: Blob, nomeFile: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nomeFile
  a.click()
  URL.revokeObjectURL(url)
}

export function TimbratureStampeStorico() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<Entry | null>(null)
  const [bulkBusy, setBulkBusy] = useState<"zip" | "delete" | null>(null)

  // Selezione multipla (righe della pagina corrente).
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Filtri.
  const [q, setQ] = useState("")
  const [mese, setMese] = useState(ALL)
  const [anno, setAnno] = useState(ALL)
  const [offset, setOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const hasFilters = q !== "" || mese !== ALL || anno !== ALL

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (q !== "") count++
    if (mese !== ALL) count++
    if (anno !== ALL) count++
    return count
  }, [q, mese, anno])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (mese !== ALL) params.set("mese", mese)
    if (anno !== ALL) params.set("anno", anno)
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(offset))

    const timer = setTimeout(() => {
      fetch(`/api/admin/timbrature/stampe?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error("Caricamento dello storico non riuscito")
          return res.json() as Promise<{ entries: Entry[]; total: number }>
        })
        .then((data) => {
          if (!active) return
          setEntries(data.entries)
          setTotal(data.total)
          setLoading(false)
          // La selezione si riferisce alla pagina appena caricata: un nuovo
          // filtro/pagina/reload la azzera, così non si rischia di agire su
          // righe non più visibili.
          setSelected(new Set())
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
  }, [q, mese, anno, offset, reloadKey])

  function resetToFirstPage() {
    setOffset(0)
  }

  function clearFilters() {
    setQ("")
    setMese(ALL)
    setAnno(ALL)
    setOffset(0)
    setMobileFilterOpen(false)
  }

  function handleRefresh() {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
    setTimeout(() => setRefreshing(false), 400)
  }

  function toggleSelected(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const isAllSelected = entries.length > 0 && entries.every((e) => selected.has(e.id))
  const isSomeSelected = selected.size > 0 && !isAllSelected

  function toggleSelectAll() {
    setSelected(isAllSelected ? new Set() : new Set(entries.map((e) => e.id)))
  }

  function handleView(entry: Entry) {
    window.open(
      `/api/admin/timbrature/stampe/${entry.id}/download?inline=1`,
      "_blank",
      "noopener,noreferrer"
    )
  }

  async function handleDownload(entry: Entry) {
    setDownloadingId(entry.id)
    try {
      const res = await fetch(
        `/api/admin/timbrature/stampe/${entry.id}/download`
      )
      if (!res.ok) throw new Error("Impossibile scaricare la stampa")
      scaricaBlob(await res.blob(), entry.originalName)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Impossibile scaricare la stampa"
      )
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDeleteOne(entry: Entry) {
    setDeletingId(entry.id)
    try {
      const res = await fetch(`/api/admin/timbrature/stampe/${entry.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error(await readError(res))
      toast.success("Stampa eliminata")
      setReloadKey((k) => k + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setDeletingId(null)
      setPendingDeleteEntry(null)
    }
  }

  async function handleBulkZip() {
    const ids = [...selected]
    setBulkBusy("zip")
    try {
      const res = await fetch("/api/admin/timbrature/stampe/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error(await readError(res))
      const data = new Date().toISOString().slice(0, 10)
      scaricaBlob(await res.blob(), `storico-stampe-${data}.zip`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Impossibile creare lo ZIP"
      )
    } finally {
      setBulkBusy(null)
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected]
    setBulkBusy("delete")
    try {
      const res = await fetch("/api/admin/timbrature/stampe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error(await readError(res))
      const { deleted } = (await res.json()) as { deleted: number }
      toast.success(`${deleted} stamp${deleted === 1 ? "a eliminata" : "e eliminate"}`)
      setReloadKey((k) => k + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setBulkBusy(null)
    }
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const meseSelect = (className: string) => (
    <Select
      value={mese}
      onValueChange={(v) => {
        setMese(v)
        resetToFirstPage()
      }}
    >
      <SelectTrigger className={className} aria-label="Mese">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tutti i mesi</SelectItem>
        {MESI.map((nome, i) => (
          <SelectItem key={nome} value={String(i + 1)}>
            {nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const annoSelect = (className: string) => (
    <Select
      value={anno}
      onValueChange={(v) => {
        setAnno(v)
        resetToFirstPage()
      }}
    >
      <SelectTrigger className={className} aria-label="Anno">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tutti gli anni</SelectItem>
        {ANNI.map((a) => (
          <SelectItem key={a} value={String(a)}>
            {a}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const rigaAzioni = (e: Entry) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Azioni">
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleView(e)}>
          <EyeIcon data-icon="inline-start" />
          Visualizza
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleDownload(e)}
          disabled={downloadingId === e.id}
        >
          {downloadingId === e.id ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <DownloadIcon data-icon="inline-start" />
          )}
          Scarica
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={() => setPendingDeleteEntry(e)}
          disabled={deletingId === e.id}
        >
          {deletingId === e.id ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Trash2Icon data-icon="inline-start" />
          )}
          Elimina
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro</CardTitle>
        <CardDescription>
          Un PDF per riga, dal più recente. Usa i filtri per restringere la
          ricerca, seleziona più righe per scaricarle o eliminarle insieme.
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
          <Input
            className="w-64"
            placeholder="Dipendente (nome o codice)"
            aria-label="Dipendente"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              resetToFirstPage()
            }}
          />
          {meseSelect("w-40")}
          {annoSelect("w-32")}

          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} aria-label="Azzera filtri">
              <XIcon data-icon="inline-start" />
              Azzera filtri
            </Button>
          )}
        </div>

        {/* Mobile — Drawer filtri */}
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
                  <DrawerDescription className="sr-only">
                    Filtra lo storico per dipendente, mese e anno.
                  </DrawerDescription>
                  {hasFilters && (
                    <Button
                      variant="ghost"
                      onClick={clearFilters}
                      size="sm"
                      aria-label="Azzera filtri"
                    >
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
                  <Input
                    placeholder="Dipendente (nome o codice)"
                    aria-label="Dipendente"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value)
                      resetToFirstPage()
                    }}
                  />
                  {meseSelect("w-full")}
                  {annoSelect("w-full")}
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

        {/* Barra azioni massive — visibile solo con una selezione attiva */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">
              {selected.size} selezionat{selected.size === 1 ? "a" : "e"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={bulkBusy !== null}
                onClick={handleBulkZip}
              >
                {bulkBusy === "zip" ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <FileArchiveIcon data-icon="inline-start" />
                )}
                Scarica ZIP
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkBusy !== null}
                  >
                    {bulkBusy === "delete" ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Trash2Icon data-icon="inline-start" />
                    )}
                    Elimina
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Eliminare {selected.size} stamp
                      {selected.size === 1 ? "a" : "e"}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      I PDF selezionati verranno eliminati in modo permanente
                      dallo storico.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleBulkDelete}
                    >
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {/* Desktop — tabella */}
        <div className="hidden overflow-hidden rounded-lg border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Seleziona tutte le righe"
                    checked={
                      isAllSelected ? true : isSomeSelected ? "indeterminate" : false
                    }
                    onCheckedChange={toggleSelectAll}
                    disabled={entries.length === 0}
                  />
                </TableHead>
                <TableHead className="w-44">Generata</TableHead>
                <TableHead>Dipendente</TableHead>
                <TableHead className="w-36">Periodo</TableHead>
                <TableHead>Modello</TableHead>
                <TableHead>Da</TableHead>
                <TableHead className="w-px text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 p-0">
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <InfoIcon />
                        </EmptyMedia>
                        <EmptyTitle>Nessuna stampa</EmptyTitle>
                        <EmptyDescription>
                          Nessuna stampa corrisponde a questi filtri, oppure non
                          ne è stata ancora generata nessuna dalla pagina
                          Timbrature.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e) => (
                  <TableRow key={e.id} data-state={selected.has(e.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Seleziona la stampa di ${dipendenteLabel(e)}`}
                        checked={selected.has(e.id)}
                        onCheckedChange={(c) => toggleSelected(e.id, c === true)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {fmtData(e.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {dipendenteLabel(e)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {MESI[e.mese - 1]} {e.anno}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {templateNome(e.templateId)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.actorEmail ?? e.actorId ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{rigaAzioni(e)}</TableCell>
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
                </CardContent>
              </Card>
            ))
          ) : entries.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <InfoIcon />
                </EmptyMedia>
                <EmptyTitle>Nessuna stampa</EmptyTitle>
                <EmptyDescription>
                  Nessuna stampa corrisponde a questi filtri, oppure non ne è
                  stata ancora generata nessuna dalla pagina Timbrature.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            entries.map((e) => (
              <Card key={e.id} size="sm">
                <CardContent>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <Checkbox
                        className="mt-0.5"
                        aria-label={`Seleziona la stampa di ${dipendenteLabel(e)}`}
                        checked={selected.has(e.id)}
                        onCheckedChange={(c) => toggleSelected(e.id, c === true)}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {dipendenteLabel(e)}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {MESI[e.mese - 1]} {e.anno}
                        </div>
                      </div>
                    </div>
                    {rigaAzioni(e)}
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div>{templateNome(e.templateId)}</div>
                    <div className="tabular-nums">{fmtData(e.createdAt)}</div>
                    <div>{e.actorEmail ?? e.actorId ?? "—"}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <AlertDialog
          open={pendingDeleteEntry !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDeleteEntry(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare questa stampa?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDeleteEntry &&
                  `Il PDF di ${dipendenteLabel(pendingDeleteEntry)} (${MESI[pendingDeleteEntry.mese - 1]} ${pendingDeleteEntry.anno}) verrà eliminato in modo permanente dallo storico.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDeleteEntry(null)}>
                Annulla
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  const entry = pendingDeleteEntry
                  setPendingDeleteEntry(null)
                  if (entry) handleDeleteOne(entry)
                }}
              >
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
      <CardFooter className="flex-col items-center gap-3 md:flex-row md:justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">
          {total} stamp{total === 1 ? "a" : "e"}
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
