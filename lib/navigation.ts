import {
  CalendarClockIcon,
  ClockIcon,
  FolderIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ScrollTextIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

// Configurazione di navigazione condivisa: sia la sidebar sia il breadcrumb
// leggono da qui, così le voci di menu restano allineate in un solo punto.
export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "I miei file", url: "/files", icon: FolderIcon },
]

// Voci riservate agli amministratori: mostrate nella sidebar solo se l'utente
// ha ruolo `admin` (vedi components/app-sidebar.tsx). La protezione reale resta
// comunque server-side nelle pagine (requireRole).
export const adminNavItems: NavItem[] = [
  { title: "Gestione utenti", url: "/admin/users", icon: UsersIcon },
  { title: "Operazioni in background", url: "/admin/jobs", icon: ListChecksIcon },
  { title: "Timbrature", url: "/admin/timbrature", icon: ClockIcon },
  { title: "Orari di lavoro", url: "/admin/orari-lavoro", icon: CalendarClockIcon },
  { title: "Audit log", url: "/admin/audit", icon: ScrollTextIcon },
  { title: "Impostazioni di sistema", url: "/admin/settings", icon: SettingsIcon },
]
