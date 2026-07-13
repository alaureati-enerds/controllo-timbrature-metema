import type { LucideIcon } from "lucide-react"

import { adminNavItems, navItems } from "@/lib/navigation"

// Ricerca globale: registro delle "fonti" interrogate dalla palette in topbar
// (components/global-search.tsx). Ogni fonte produce un gruppo di risultati.
//
// Per aggiungere un nuovo tipo di record alla ricerca basta:
//   1. esporre lato dati una funzione di ricerca + una pagina di dettaglio;
//   2. aggiungere qui una nuova `SearchSource` all'array `searchSources`.
// Vedi docs/ricerca-globale.md per la guida completa.

// Singolo risultato. `href` è la destinazione al click (di norma una pagina di
// dettaglio parametrica).
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
  // memoria, come la navigazione) o asincrona (chiamata a un'API). Con query
  // vuota può restituire suggerimenti iniziali o un array vuoto.
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

// L'ordine qui è l'ordine dei gruppi nella palette.
export const searchSources: SearchSource[] = [navigationSource]
