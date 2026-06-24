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
import { navItems } from "@/lib/navigation"

// Titolo della voce corrente. Se la rotta è registrata in navItems usa il suo
// titolo; altrimenti deriva un'etichetta leggibile dall'ultimo segmento del
// path, così una rotta sconosciuta non viene etichettata come "Dashboard".
function currentTitle(pathname: string) {
  const item = navItems.find((item) => item.url === pathname)
  if (item) return item.title

  const segment = pathname.split("/").filter(Boolean).pop()
  if (!segment) return navItems[0].title

  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

export function AppBreadcrumb() {
  const pathname = usePathname()
  const title = currentTitle(pathname)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href="/">shadcn starter</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
