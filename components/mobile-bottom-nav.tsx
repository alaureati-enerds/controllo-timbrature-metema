"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BellIcon,
  FolderIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MenuIcon,
  NotebookPenIcon,
  ScrollTextIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { hasRole } from "@/lib/roles"
import { cn } from "@/lib/utils"

type BottomNavItem = { label: string; url: string; icon: LucideIcon }

// Le prime 4 destinazioni della barra sono role-aware: l'admin vede scorciatoie
// di amministrazione, l'utente normale le sue. Il 5° slot (Menu) è sempre uguale
// e apre la pagina con la navigazione completa.
const userItems: BottomNavItem[] = [
  { label: "Home", url: "/", icon: LayoutDashboardIcon },
  { label: "Note", url: "/notes", icon: NotebookPenIcon },
  { label: "File", url: "/files", icon: FolderIcon },
  { label: "Notifiche", url: "/notifications", icon: BellIcon },
]

const adminItems: BottomNavItem[] = [
  { label: "Home", url: "/", icon: LayoutDashboardIcon },
  { label: "Utenti", url: "/admin/users", icon: UsersIcon },
  { label: "Operazioni", url: "/admin/jobs", icon: ListChecksIcon },
  { label: "Audit", url: "/admin/audit", icon: ScrollTextIcon },
]

const menuItem: BottomNavItem = { label: "Menu", url: "/menu", icon: MenuIcon }

// La voce è attiva sulla rotta esatta o su una sua sotto-rotta (es. /notes/123
// tiene attiva "Note"); per la Home solo sul match esatto, altrimenti sarebbe
// sempre attiva.
function isActive(pathname: string, url: string) {
  if (url === "/") return pathname === "/"
  return pathname === url || pathname.startsWith(`${url}/`)
}

// Barra di navigazione inferiore: visibile solo su mobile (la sidebar resta la
// navigazione del desktop). `pb` da safe-area per stare sopra l'home indicator.
export function MobileBottomNav() {
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const isAdmin = hasRole(session?.user.role, "admin")
  const items = [...(isAdmin ? adminItems : userItems), menuItem]

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const active = isActive(pathname, item.url)
          return (
            <li key={item.url} className="flex-1">
              <Link
                href={item.url}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 w-full touch-manipulation items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Solo icona: l'etichetta resta come `aria-label`; la voce
                    attiva si distingue per il colore (primario vs muted). */}
                <item.icon aria-hidden="true" className="size-6 shrink-0" />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
