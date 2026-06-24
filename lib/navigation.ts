import {
  FileQuestionIcon,
  FlaskConicalIcon,
  HourglassIcon,
  LayoutDashboardIcon,
  NotebookPenIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"

// Configurazione di navigazione condivisa: sia la sidebar sia il breadcrumb
// leggono da qui, così le voci di menu restano allineate in un solo punto.
export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
}

export type NavGroup = {
  title: string
  icon: LucideIcon
  items: NavItem[]
}

// Voci principali (menu piatto).
export const navMain: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "Note", url: "/notes", icon: NotebookPenIcon },
]

// Gruppo collassabile con le pagine dimostrative/di test.
// Rimuovibile in blocco quando non serve più.
export const navTest: NavGroup = {
  title: "Test",
  icon: FlaskConicalIcon,
  items: [
    { title: "Skeleton", url: "/test/skeleton", icon: HourglassIcon },
    { title: "Errore", url: "/test/errore", icon: TriangleAlertIcon },
    { title: "Pagina inesistente", url: "/test/non-trovato", icon: FileQuestionIcon },
  ],
}

// Lista piatta usata dal breadcrumb per risolvere il titolo della rotta corrente.
export const allNavItems: NavItem[] = [...navMain, ...navTest.items]
