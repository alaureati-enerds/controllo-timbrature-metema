"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FilterIcon,
  LockOpenIcon,
  SearchIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { initials } from "@/lib/initials"
import { cn } from "@/lib/utils"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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

type AdminUser = {
  id: string
  name: string
  email: string
  image?: string | null
  role?: string | null
  banned?: boolean | null
}

const ROLES = ["user", "admin"] as const
const PAGE_SIZE = 10

// Filtri a preset: l'API admin accetta un solo filtro per query, quindi sono
// mutuamente esclusivi (uno alla volta), e convivono con la ricerca.
const FILTERS = [
  { value: "all", label: "Tutti" },
  { value: "admin", label: "Solo admin" },
  { value: "user", label: "Solo utenti" },
  { value: "banned", label: "Bannati" },
] as const
type FilterValue = (typeof FILTERS)[number]["value"]

// Traduce un preset nei parametri filterField/Operator/Value dell'API admin.
function filterQuery(filter: FilterValue) {
  switch (filter) {
    case "admin":
      return {
        filterField: "role",
        filterOperator: "eq" as const,
        filterValue: "admin",
      }
    case "user":
      return {
        filterField: "role",
        filterOperator: "eq" as const,
        filterValue: "user",
      }
    case "banned":
      return {
        filterField: "banned",
        filterOperator: "eq" as const,
        filterValue: true,
      }
    default:
      return {}
  }
}

export function UsersManager() {
  const { data: current } = authClient.useSession()
  const currentUserId = current?.user.id

  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Ricerca (con debounce), filtro e paginazione
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterValue>("all")
  const [page, setPage] = useState(0)
  // Incrementato dopo le mutazioni per forzare il ricaricamento della lista.
  const [refreshKey, setRefreshKey] = useState(0)
  // Drawer filtri su mobile (la ricerca resta sempre visibile fuori).
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  // Cambio ruolo in attesa di conferma (azione di sicurezza con effetti reali).
  const [pendingRole, setPendingRole] = useState<{
    user: AdminUser
    role: (typeof ROLES)[number]
  } | null>(null)

  // Form di creazione manuale
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<(typeof ROLES)[number]>("user")
  const [creating, setCreating] = useState(false)

  // Debounce della ricerca: applica il testo digitato e torna a pagina 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0)
      setSearch(searchInput.trim())
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Caricamento lista al variare di pagina, ricerca, filtro o refreshKey. Lo
  // stato viene aggiornato nella callback `.then` (asincrona), non nel corpo.
  useEffect(() => {
    let active = true
    authClient.admin
      .listUsers({
        query: {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          sortBy: "createdAt",
          sortDirection: "desc",
          ...(search
            ? {
                // Cerca per email se il testo sembra un indirizzo, altrimenti
                // per nome: l'API accetta un solo campo di ricerca per volta.
                searchField: (search.includes("@") ? "email" : "name") as
                  | "email"
                  | "name",
                searchOperator: "contains" as const,
                searchValue: search,
              }
            : {}),
          ...filterQuery(filter),
        },
      })
      .then(({ data, error }) => {
        if (!active) return
        setLoading(false)
        if (error) {
          toast.error(error.message ?? "Impossibile caricare gli utenti")
          return
        }
        setUsers((data?.users ?? []) as AdminUser[])
        setTotal(data?.total ?? 0)
      })
    return () => {
      active = false
    }
  }, [page, search, filter, refreshKey])

  const refresh = () => setRefreshKey((k) => k + 1)

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    const { error } = await authClient.admin.createUser({
      name,
      email,
      password,
      role,
      // Gli account creati dall'admin sono già verificati: niente passaggio di
      // verifica email al primo accesso.
      data: { emailVerified: true },
    })
    setCreating(false)
    if (error) {
      toast.error(error.message ?? "Creazione non riuscita")
      return
    }
    toast.success("Utente creato")
    setName("")
    setEmail("")
    setPassword("")
    setRole("user")
    setCreateOpen(false)
    refresh()
  }

  async function handleSetRole(userId: string, newRole: string) {
    setBusyId(userId)
    const { error } = await authClient.admin.setRole({
      userId,
      role: newRole as (typeof ROLES)[number],
    })
    setBusyId(null)
    if (error) {
      toast.error(error.message ?? "Aggiornamento ruolo non riuscito")
      return
    }
    toast.success("Ruolo aggiornato")
    refresh()
  }

  async function handleToggleBan(user: AdminUser) {
    setBusyId(user.id)
    const { error } = user.banned
      ? await authClient.admin.unbanUser({ userId: user.id })
      : await authClient.admin.banUser({ userId: user.id })
    setBusyId(null)
    if (error) {
      toast.error(error.message ?? "Operazione non riuscita")
      return
    }
    toast.success(user.banned ? "Utente riabilitato" : "Utente bannato")
    refresh()
  }

  async function handleRemove(user: AdminUser) {
    setBusyId(user.id)
    const { error } = await authClient.admin.removeUser({ userId: user.id })
    setBusyId(null)
    if (error) {
      toast.error(error.message ?? "Eliminazione non riuscita")
      return
    }
    toast.success("Utente eliminato")
    refresh()
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE)
  // Su mobile anche la ricerca sta nel Drawer: la conto tra i filtri attivi.
  const activeFilterCount =
    (filter !== "all" ? 1 : 0) + (searchInput.trim() !== "" ? 1 : 0)
  const hasActiveFilter = activeFilterCount > 0

  function clearFilters() {
    setPage(0)
    setFilter("all")
    setSearchInput("")
  }

  // Campo ricerca riusato da toolbar desktop e Drawer mobile.
  function searchField(className?: string) {
    return (
      <div className={cn("relative", className)}>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cerca per nome o email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-8"
          aria-label="Cerca utenti per nome o email"
        />
        {searchInput && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Azzera la ricerca"
                className="absolute top-1/2 right-1.5 -translate-y-1/2"
                onClick={() => setSearchInput("")}
              >
                <XIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Azzera</TooltipContent>
          </Tooltip>
        )}
      </div>
    )
  }

  // Celle riusate da tabella desktop e card mobile (un'unica fonte).
  function roleSelect(u: AdminUser, isSelf: boolean) {
    return (
      <Select
        value={u.role ?? "user"}
        disabled={busyId === u.id || isSelf}
        onValueChange={(v) =>
          setPendingRole({ user: u, role: v as (typeof ROLES)[number] })
        }
      >
        <SelectTrigger
          size="sm"
          className="w-full"
          aria-label={
            isSelf ? "Non puoi cambiare il tuo ruolo" : `Ruolo di ${u.name}`
          }
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r} value={r} className="capitalize">
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  function statusBadge(u: AdminUser) {
    return u.banned ? (
      <Badge variant="destructive">Bannato</Badge>
    ) : (
      <Badge variant="outline">Attivo</Badge>
    )
  }

  function rowActions(u: AdminUser, isSelf: boolean) {
    return (
      <div className="flex justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Apri dettaglio"
              asChild
            >
              <Link href={`/admin/users/${u.id}`}>
                <EyeIcon />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Dettaglio</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={u.banned ? "Sblocca utente" : "Banna utente"}
              disabled={busyId === u.id || isSelf}
              onClick={() => handleToggleBan(u)}
            >
              {u.banned ? <LockOpenIcon /> : <BanIcon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isSelf
              ? "Non puoi bannare te stesso"
              : u.banned
                ? "Sblocca"
                : "Banna"}
          </TooltipContent>
        </Tooltip>
        <DeleteUserDialog
          user={u}
          disabled={busyId === u.id || isSelf}
          onConfirm={() => handleRemove(u)}
        />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Utenti</CardTitle>
        <CardDescription>
          {total} {total === 1 ? "account registrato" : "account registrati"}.
          Gestisci ruoli e accesso; apri il dettaglio per le azioni avanzate.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Barra strumenti: ricerca + filtro a sinistra, creazione a destra. */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
            {/* Desktop — ricerca sempre visibile (su mobile è nel Drawer) */}
            {searchField("hidden md:block md:max-w-xs md:flex-1")}
            {/* Desktop — filtro preset in linea */}
            <Select
              value={filter}
              onValueChange={(v) => {
                setPage(0)
                setFilter(v as FilterValue)
              }}
            >
              <SelectTrigger
                className="hidden md:flex md:w-40"
                aria-label="Filtra utenti"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mobile — Drawer filtri */}
            <div className="md:hidden">
              <Drawer open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                <DrawerTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <FilterIcon data-icon="inline-start" />
                    Filtri
                    {hasActiveFilter && (
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
                      {hasActiveFilter && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Azzera filtri"
                          onClick={clearFilters}
                        >
                          <XIcon className="size-4" />
                          Azzera
                        </Button>
                      )}
                    </div>
                    <DrawerDescription className="sr-only">
                      Cerca e filtra gli utenti per ruolo e stato.
                    </DrawerDescription>
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
                      {searchField()}
                      <Select
                        value={filter}
                        onValueChange={(v) => {
                          setPage(0)
                          setFilter(v as FilterValue)
                        }}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label="Filtra utenti"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FILTERS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlusIcon data-icon="inline-start" />
                Nuovo utente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crea utente</DialogTitle>
                <DialogDescription>
                  L&apos;account viene creato con email già verificata.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="c-name">Nome</FieldLabel>
                    <Input
                      id="c-name"
                      autoComplete="off"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={creating}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="c-email">Email</FieldLabel>
                    <Input
                      id="c-email"
                      type="email"
                      autoComplete="off"
                      spellCheck={false}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={creating}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="c-password">Password</FieldLabel>
                    <Input
                      id="c-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={creating}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="c-role">Ruolo</FieldLabel>
                    <Select
                      value={role}
                      onValueChange={(v) =>
                        setRole(v as (typeof ROLES)[number])
                      }
                      disabled={creating}
                    >
                      <SelectTrigger id="c-role" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={creating}>
                      Annulla
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <Spinner />
                    ) : (
                      <UserPlusIcon data-icon="inline-start" />
                    )}
                    Crea utente
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Desktop — tabella */}
        <div className="hidden md:block">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner /> Caricamento…
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utente</TableHead>
                    <TableHead className="w-36">Ruolo</TableHead>
                    <TableHead className="w-28">Stato</TableHead>
                    <TableHead className="w-px text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Nessun utente trovato.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => {
                      const isSelf = u.id === currentUserId
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-9">
                                {u.image && (
                                  <AvatarImage src={u.image} alt="" />
                                )}
                                <AvatarFallback className="text-xs">
                                  {initials(u.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate font-medium">
                                  {u.name}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{roleSelect(u, isSelf)}</TableCell>
                          <TableCell>{statusBadge(u)}</TableCell>
                          <TableCell>{rowActions(u, isSelf)}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Mobile — lista di card */}
        <div className="flex flex-col gap-3 md:hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} size="sm">
                <CardContent className="flex items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : users.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>Nessun utente</EmptyTitle>
                <EmptyDescription>
                  Nessun utente corrisponde a ricerca e filtri. Prova ad
                  azzerarli.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            users.map((u) => {
              const isSelf = u.id === currentUserId
              return (
                <Card key={u.id} size="sm">
                  <CardContent>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-9 shrink-0">
                          {u.image && <AvatarImage src={u.image} alt="" />}
                          <AvatarFallback className="text-xs">
                            {initials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 truncate font-medium">
                              {u.name}
                            </span>
                            {statusBadge(u)}
                          </div>
                          <span className="truncate text-xs text-muted-foreground">
                            {u.email}
                          </span>
                        </div>
                      </div>
                      <UserActionsMenu
                        user={u}
                        disabled={busyId === u.id || isSelf}
                        onToggleBan={handleToggleBan}
                        onRemove={handleRemove}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-center gap-3 text-sm md:flex-row md:justify-between">
        <span className="text-muted-foreground tabular-nums">
          {rangeStart}–{rangeEnd} di {total} · pagina {page + 1} di {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            Precedente
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Successiva
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </CardFooter>

      {/* Conferma del cambio ruolo dalla tabella. */}
      <AlertDialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRole(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiare il ruolo?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole?.role === "admin" ? (
                <>
                  <span className="font-medium text-foreground">
                    {pendingRole?.user.name}
                  </span>{" "}
                  diventerà amministratore, con pieno accesso alle aree
                  riservate e alla gestione degli altri utenti.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {pendingRole?.user.name}
                  </span>{" "}
                  tornerà utente standard e perderà l&apos;accesso alle aree
                  riservate.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRole) {
                  handleSetRole(pendingRole.user.id, pendingRole.role)
                }
                setPendingRole(null)
              }}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function DeleteUserDialog({
  user,
  disabled,
  onConfirm,
}: {
  user: AdminUser
  disabled: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Elimina utente"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={disabled}
            >
              <Trash2Icon />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Elimina</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            L&apos;account {user.email} e i suoi dati verranno rimossi
            definitivamente. L&apos;azione non è reversibile.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Elimina
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Azioni utente compatte per le card mobile: un solo bottone «⋮» con dropdown.
// L'eliminazione è dietro un AlertDialog annidato (onSelect preventDefault
// tiene aperto il menu mentre si conferma).
function UserActionsMenu({
  user,
  disabled,
  onToggleBan,
  onRemove,
}: {
  user: AdminUser
  disabled: boolean
  onToggleBan: (user: AdminUser) => void
  onRemove: (user: AdminUser) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Azioni utente">
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/admin/users/${user.id}`}>
            <EyeIcon />
            Dettaglio
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled}
          onSelect={() => onToggleBan(user)}
        >
          {user.banned ? <LockOpenIcon /> : <BanIcon />}
          {user.banned ? "Sblocca" : "Banna"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              variant="destructive"
              disabled={disabled}
              onSelect={(e) => e.preventDefault()}
            >
              <Trash2Icon />
              Elimina
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare {user.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                L&apos;account {user.email} e i suoi dati verranno rimossi
                definitivamente. L&apos;azione non è reversibile.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => onRemove(user)}
              >
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
