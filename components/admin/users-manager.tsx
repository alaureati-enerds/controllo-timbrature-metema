"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  LockOpenIcon,
  SearchIcon,
  Trash2Icon,
  UserPlusIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { initials } from "@/lib/initials"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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

type AdminUser = {
  id: string
  name: string
  email: string
  role?: string | null
  banned?: boolean | null
}

const ROLES = ["user", "admin"] as const
const PAGE_SIZE = 10

export function UsersManager() {
  const { data: current } = authClient.useSession()
  const currentUserId = current?.user.id

  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Ricerca e paginazione
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  // Incrementato dopo le mutazioni per forzare il ricaricamento della lista.
  const [refreshKey, setRefreshKey] = useState(0)

  // Form di creazione manuale
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<(typeof ROLES)[number]>("user")
  const [creating, setCreating] = useState(false)

  // Caricamento lista al variare di pagina, ricerca o refreshKey. Lo stato viene
  // aggiornato nella callback `.then` (asincrona), non nel corpo dell'effetto.
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
            ? { searchField: "email" as const, searchValue: search }
            : {}),
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
  }, [page, search, refreshKey])

  const refresh = () => setRefreshKey((k) => k + 1)

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(0)
    setSearch(searchInput.trim())
  }

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Utenti</CardTitle>
        <CardDescription>
          {total} {total === 1 ? "account" : "account"} registrati. Gestisci
          ruoli e accesso; apri il dettaglio per le azioni avanzate.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Barra strumenti: ricerca a sinistra, creazione a destra. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={handleSearch} className="flex gap-2 sm:max-w-sm">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca per email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline">
              <SearchIcon data-icon="inline-start" />
              Cerca
            </Button>
            {search && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchInput("")
                  setSearch("")
                  setPage(0)
                }}
              >
                <XIcon data-icon="inline-start" />
                Azzera
              </Button>
            )}
          </form>

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
                        <TableCell>
                          <Select
                            value={u.role ?? "user"}
                            disabled={busyId === u.id}
                            onValueChange={(v) => handleSetRole(u.id, v)}
                          >
                            <SelectTrigger size="sm" className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem
                                  key={r}
                                  value={r}
                                  className="capitalize"
                                >
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {u.banned ? (
                            <Badge variant="destructive">Bannato</Badge>
                          ) : (
                            <Badge variant="outline">Attivo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
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
                                  aria-label={
                                    u.banned ? "Sblocca utente" : "Banna utente"
                                  }
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
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {rangeStart}–{rangeEnd} di {total} · pagina {page + 1} di{" "}
            {totalPages}
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
        </div>
      </CardContent>
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
