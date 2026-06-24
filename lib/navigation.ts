import { LayoutDashboardIcon, NotebookPenIcon, type LucideIcon } from "lucide-react"

// Configurazione di navigazione condivisa: sia la sidebar sia il breadcrumb
// leggono da qui, così le voci di menu restano allineate in un solo punto.
export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "Note", url: "/notes", icon: NotebookPenIcon },
]
