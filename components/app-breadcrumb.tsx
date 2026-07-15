"use client"

import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { adminNavItems, adminPrimaryNavItems, navItems } from "@/lib/navigation"

// Rotte non presenti nei menu (es. la pagina notifiche, raggiungibile solo dalla
// campanella) ma che vogliamo etichettare in italiano nel breadcrumb.
const EXTRA_TITLES: Record<string, string> = {
  "/notifications": "Notifiche",
  "/files": "I miei file",
}

// Titolo della voce corrente. Cerca prima nei menu (piattaforma e admin), poi
// nelle rotte extra; altrimenti deriva un'etichetta leggibile dall'ultimo
// segmento del path, così una rotta sconosciuta non viene etichettata come
// "Dashboard".
function currentTitle(pathname: string) {
  const item = [...navItems, ...adminPrimaryNavItems, ...adminNavItems].find(
    (item) => item.url === pathname
  )
  if (item) return item.title
  if (EXTRA_TITLES[pathname]) return EXTRA_TITLES[pathname]

  const segment = pathname.split("/").filter(Boolean).pop()
  if (!segment) return navItems[0].title

  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

export function AppBreadcrumb({ appName }: { appName: string }) {
  const pathname = usePathname()
  const title = currentTitle(pathname)

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href="/">{appName}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem className="min-w-0">
          {/* truncate: su mobile il titolo della pagina non deve spingere fuori
              i bottoni icona della topbar. */}
          <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
