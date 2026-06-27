# Ricerca globale (topbar)

Guida di riferimento per la barra di ricerca nella topbar della dashboard: una
palette (stile ⌘K) che propone **scorciatoie alle voci di menu** e, sotto, i
**record** dell'utente (oggi le note), con apertura della pagina di dettaglio al
click. È pensata per essere **estensibile**: aggiungere un nuovo tipo di record
significa registrare una nuova "fonte di ricerca".

## Come funziona

I pezzi coinvolti:

- **[components/global-search.tsx](../components/global-search.tsx)** — la UI: il
  trigger in topbar (un campo che sembra una ricerca, su mobile solo un'icona) e
  la palette `CommandDialog`. Gestisce la scorciatoia ⌘K/Ctrl+K, il debounce
  della query e la navigazione al click. **Non va toccata** per aggiungere record:
  itera automaticamente sulle fonti registrate.
- **[lib/search/sources.ts](../lib/search/sources.ts)** — il **registro delle
  fonti**. Ogni fonte produce un gruppo di risultati nella palette. È qui che si
  estende la ricerca.
- I componenti shadcn `command`, `input-group`, `kbd` (in
  [components/ui/](../components/ui)) — le primitive. Non si toccano: si compongono.

La palette disattiva il filtro interno di `cmdk` (`shouldFilter={false}`): è ogni
fonte a decidere i propri risultati. La navigazione filtra in memoria, le note
cercano lato server.

## Anatomia di una fonte

```ts
export type SearchResult = {
  id: string          // univoco e stabile (es. `note:<id>`)
  label: string       // testo mostrato
  description?: string
  icon?: LucideIcon
  href: string        // destinazione al click (es. /notes/<id>)
}

export type SearchContext = {
  isAdmin: boolean    // info sull'utente corrente, utili a filtrare
}

export type SearchSource = {
  id: string
  heading: string     // titolo del gruppo nella palette
  search: (query: string, ctx: SearchContext) => SearchResult[] | Promise<SearchResult[]>
}
```

Una fonte può essere **sincrona** (dati già in memoria, come la navigazione) o
**asincrona** (chiamata a un'API, come le note). Con `query` vuota può restituire
suggerimenti iniziali (le note più recenti) oppure un array vuoto.

## Aggiungere un nuovo tipo di record

Esempio: rendere ricercabili dei "progetti" con dettaglio in `/projects/<id>`.

### 1. Lato dati: ricerca + dettaglio con ownership

In `lib/projects.ts` (sul modello di [lib/notes.ts](../lib/notes.ts)):

```ts
export function searchProjects(userId: string, query: string, limit?: number) {
  const q = query.trim()
  return prisma.project.findMany({
    where: { userId, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { updatedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  })
}

export function getProject(userId: string, id: string) {
  return prisma.project.findFirst({ where: { id, userId } })
}
```

### 2. Lato API: GET con `?q=` e `?limit=`

Estendi (o crea) il route handler come in
[app/api/notes/route.ts](../app/api/notes/route.ts): leggi `q` e `limit` dalla
query string e delega a `searchProjects`. Ricorda sempre l'ownership (l'utente
vede solo i propri record).

### 3. La pagina di dettaglio parametrica

Crea `app/(dashboard)/projects/[id]/page.tsx` sul modello di
[app/(dashboard)/notes/[id]/page.tsx](<../app/(dashboard)/notes/[id]/page.tsx>):
`requireUser` → `getProject(userId, id)` → `notFound()` se `null`.

### 4. Registra la fonte

In [lib/search/sources.ts](../lib/search/sources.ts):

```ts
const projectsSource: SearchSource = {
  id: "projects",
  heading: "Progetti",
  async search(query) {
    const params = new URLSearchParams({ limit: "6" })
    const q = query.trim()
    if (q) params.set("q", q)
    const res = await fetch(`/api/projects?${params}`)
    if (!res.ok) return []
    const projects = (await res.json()) as { id: string; name: string }[]
    return projects.map((p) => ({
      id: `project:${p.id}`,
      label: p.name,
      icon: FolderIcon,
      href: `/projects/${p.id}`,
    }))
  },
}

export const searchSources: SearchSource[] = [navigationSource, notesSource, projectsSource]
```

L'ordine nell'array è l'ordine dei gruppi nella palette. Fatto: la UI non va
modificata.

## La fonte "Navigazione"

È una fonte come le altre, solo sincrona: filtra `navItems`/`adminNavItems` da
[lib/navigation.ts](../lib/navigation.ts) in base al ruolo (`ctx.isAdmin`), così
le voci admin appaiono solo agli amministratori. Aggiungendo una voce di sidebar
(vedi [creare-voce-menu-sidebar.md](creare-voce-menu-sidebar.md)) compare
automaticamente anche tra le scorciatoie di ricerca.
