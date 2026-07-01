"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { hasRole } from "@/lib/roles"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  searchSources,
  type SearchContext,
  type SearchResult,
} from "@/lib/search/sources"

type Groups = Record<string, SearchResult[]>

// Ricerca globale in topbar: un trigger che apre una palette (CommandDialog)
// con le fonti registrate in lib/search/sources.ts. Il filtro è disattivato in
// cmdk (`shouldFilter={false}`) perché ogni fonte decide da sé i risultati —
// la navigazione filtra in memoria, le note cercano lato server.
export function GlobalSearch() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const isAdmin = hasRole(session?.user.role, "admin")

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [groups, setGroups] = useState<Groups>({})

  // Scorciatoia ⌘K / Ctrl+K per aprire la palette.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  // Interroga tutte le fonti quando cambia la query (con piccolo debounce). Un
  // id di richiesta scarta le risposte arrivate in ritardo (race condition).
  const requestId = useRef(0)
  useEffect(() => {
    if (!open) return

    const ctx: SearchContext = { isAdmin }
    const id = ++requestId.current
    const timer = setTimeout(async () => {
      const entries = await Promise.all(
        searchSources.map(async (source) => {
          try {
            return [source.id, await source.search(query, ctx)] as const
          } catch {
            return [source.id, [] as SearchResult[]] as const
          }
        })
      )
      if (id === requestId.current) setGroups(Object.fromEntries(entries))
    }, 200)

    return () => clearTimeout(timer)
  }, [query, open, isAdmin])

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery("")
      router.push(href)
    },
    [router]
  )

  const hasResults = Object.values(groups).some((items) => items.length > 0)

  return (
    <>
      {/* Desktop: campo che sembra una ricerca; al click/focus apre la palette. */}
      <InputGroup className="hidden w-64 md:flex">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        {/* Solo onClick/onKeyDown: niente onFocus, altrimenti alla chiusura della
            palette il focus torna qui e la riaprirebbe in loop. */}
        <InputGroupInput
          readOnly
          placeholder="Cerca…"
          className="cursor-pointer"
          onClick={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              setOpen(true)
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <Kbd>⌘+K</Kbd>
        </InputGroupAddon>
      </InputGroup>

      {/* Mobile: solo icona per non occupare spazio in topbar. Soglia md
          (768px) allineata a useIsMobile e alla sidebar. */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Cerca"
      >
        <SearchIcon />
      </Button>

      {/* Su mobile la palette è ancorata in alto (sotto il notch): la tastiera
          sale dal basso e coprirebbe input e risultati se restasse centrata.
          Ancorandola in alto, input e primi risultati stanno sempre sopra la
          tastiera; la lista scrolla nei suoi `max-h-72`. Desktop: resta a
          top-1/3 (default del CommandDialog). */}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Ricerca globale"
        description="Cerca tra le voci di menu e i tuoi record."
        className="top-[calc(env(safe-area-inset-top)+0.5rem)] md:top-1/3"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Cerca voci di menu e note…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!hasResults && <CommandEmpty>Nessun risultato.</CommandEmpty>}
            {searchSources.map((source) => {
              const items = groups[source.id] ?? []
              if (items.length === 0) return null
              return (
                <CommandGroup key={source.id} heading={source.heading}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelect(item.href)}
                    >
                      {item.icon && <item.icon />}
                      <span className="truncate">{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
