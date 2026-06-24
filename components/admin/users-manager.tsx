"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

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
    if (!confirm(`Eliminare definitivamente ${user.email}?`)) return
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Crea utente</CardTitle>
          <CardDescription>
            Crea manualmente un account (email già verificata).
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreate}>
          <CardContent>
            <FieldGroup className="sm:grid sm:grid-cols-2 sm:gap-4">
              <Field>
                <FieldLabel htmlFor="c-name">Nome</FieldLabel>
                <Input
                  id="c-name"
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
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={creating}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-role">Ruolo</FieldLabel>
                <select
                  id="c-role"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as (typeof ROLES)[number])
                  }
                  disabled={creating}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                type="submit"
                disabled={creating}
                className="sm:col-span-2"
              >
                {creating && <Spinner />}
                Crea utente
              </Button>
            </FieldGroup>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utenti</CardTitle>
          <CardDescription>
            Gestisci ruoli e accesso. Apri il dettaglio per azioni avanzate.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Cerca per email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="max-w-xs"
            />
            <Button type="submit" variant="outline">
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
                Azzera
              </Button>
            )}
          </form>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Caricamento…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-medium">Nome</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Ruolo</th>
                    <th className="py-2 pr-4 font-medium">Stato</th>
                    <th className="py-2 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-muted-foreground"
                      >
                        Nessun utente trovato.
                      </td>
                    </tr>
                  )}
                  {users.map((u) => {
                    const isSelf = u.id === currentUserId
                    return (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{u.name}</td>
                        <td className="py-2 pr-4">{u.email}</td>
                        <td className="py-2 pr-4">
                          <select
                            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                            value={u.role ?? "user"}
                            disabled={busyId === u.id}
                            onChange={(e) =>
                              handleSetRole(u.id, e.target.value)
                            }
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-4">
                          {u.banned ? (
                            <span className="text-destructive">Bannato</span>
                          ) : (
                            <span className="text-muted-foreground">Attivo</span>
                          )}
                        </td>
                        <td className="flex flex-wrap gap-2 py-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/users/${u.id}`}>Dettaglio</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === u.id || isSelf}
                            title={
                              isSelf
                                ? "Non puoi bannare te stesso"
                                : undefined
                            }
                            onClick={() => handleToggleBan(u)}
                          >
                            {u.banned ? "Sblocca" : "Banna"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === u.id || isSelf}
                            title={
                              isSelf
                                ? "Non puoi eliminare te stesso"
                                : undefined
                            }
                            onClick={() => handleRemove(u)}
                          >
                            Elimina
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {total} utenti · pagina {page + 1} di {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Precedente
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Successiva
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
