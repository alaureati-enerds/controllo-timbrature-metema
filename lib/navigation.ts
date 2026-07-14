import {
  CalendarClockIcon,
  ClockIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ScrollTextIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

// Configurazione di navigazione condivisa: sidebar, menu mobile, breadcrumb e
// ricerca globale leggono da qui, così le voci di menu restano allineate in un
// solo punto.
export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
}

// Gruppo "Piattaforma": voci visibili a tutti.
// Nota: la pagina "I miei file" (/files) esiste ancora ed è raggiungibile, ma
// per ora è volutamente fuori dai menu.
export const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
]

// Sempre nel gruppo "Piattaforma", ma solo per gli amministratori: sono le zone
// di lavoro principali, quindi stanno in alto sotto la Dashboard e non in fondo
// tra le voci di amministrazione.
export const adminPrimaryNavItems: NavItem[] = [
  { title: "Timbrature", url: "/admin/timbrature", icon: ClockIcon },
  { title: "Orari di lavoro", url: "/admin/orari-lavoro", icon: CalendarClockIcon },
]

// Gruppo "Amministrazione": mostrato nella sidebar solo se l'utente ha ruolo
// `admin` (vedi components/app-sidebar.tsx). La protezione reale resta comunque
// server-side nelle pagine (requireRole).
export const adminNavItems: NavItem[] = [
  { title: "Gestione utenti", url: "/admin/users", icon: UsersIcon },
  { title: "Operazioni in background", url: "/admin/jobs", icon: ListChecksIcon },
  { title: "Audit log", url: "/admin/audit", icon: ScrollTextIcon },
  { title: "Impostazioni di sistema", url: "/admin/settings", icon: SettingsIcon },
]
