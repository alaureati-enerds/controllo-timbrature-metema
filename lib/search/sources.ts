import type { LucideIcon } from "lucide-react"
import { NotebookPenIcon } from "lucide-react"

import { adminNavItems, navItems } from "@/lib/navigation"

// Ricerca globale: registro delle "fonti" interrogate dalla palette in topbar
// (components/global-search.tsx). Ogni fonte produce un gruppo di risultati.
//
// Per aggiungere un nuovo tipo di record alla ricerca basta:
//   1. esporre lato dati una funzione di ricerca + una pagina di dettaglio;
//   2. aggiungere qui una nuova `SearchSource` all'array `searchSources`.
// Vedi docs/ricerca-globale.md per la guida completa.

// Singolo risultato. `href` è la destinazione al click (di norma una pagina di
// dettaglio parametrica, es. /notes/{id}).
export type SearchResult = {
  id: string
  label: string
  description?: string
  icon?: LucideIcon
  href: string
}

// Contesto passato a ogni fonte: informazioni dell'utente corrente utili a
// filtrare i risultati (es. nascondere voci admin a chi non lo è).
export type SearchContext = {
  isAdmin: boolean
}

export type SearchSource = {
  id: string
  // Titolo del gruppo mostrato nella palette.
  heading: string
  // Ricerca i risultati per la query data. Può essere sincrona (dati già in
  // memoria, come la navigazione) o asincrona (chiamata a un'API, come le note).
  // Con query vuota può restituire suggerimenti iniziali o un array vuoto.
  search: (
    query: string,
    ctx: SearchContext
  ) => SearchResult[] | Promise<SearchResult[]>
}

// Fonte "Navigazione": scorciatoie alle voci di menu. È sincrona perché le voci
// sono già in memoria (lib/navigation.ts); filtra quelle admin in base al ruolo.
const navigationSource: SearchSource = {
  id: "navigation",
  heading: "Navigazione",
  search(query, ctx) {
    const items = [...navItems, ...(ctx.isAdmin ? adminNavItems : [])]
    const q = query.trim().toLowerCase()
    const matched = q
      ? items.filter((item) => item.title.toLowerCase().includes(q))
      : items
    return matched.map((item) => ({
      id: `nav:${item.url}`,
      label: item.title,
      icon: item.icon,
      href: item.url,
    }))
  },
}

// Fonte "Note": record dell'utente. È asincrona: interroga l'API che cerca lato
// server (GET /api/notes?q=&limit=). Con query vuota mostra le note più recenti.
const NOTES_LIMIT = 6

const notesSource: SearchSource = {
  id: "notes",
  heading: "Note",
  async search(query) {
    const params = new URLSearchParams({ limit: String(NOTES_LIMIT) })
    const q = query.trim()
    if (q) params.set("q", q)

    const res = await fetch(`/api/notes?${params.toString()}`)
    if (!res.ok) return []

    const notes = (await res.json()) as { id: string; text: string }[]
    return notes.map((note) => ({
      id: `note:${note.id}`,
      label: note.text,
      icon: NotebookPenIcon,
      href: `/notes/${note.id}`,
    }))
  },
}

// L'ordine qui è l'ordine dei gruppi nella palette.
export const searchSources: SearchSource[] = [navigationSource, notesSource]
