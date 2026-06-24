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
import { allNavItems, navMain, navTest } from "@/lib/navigation"

export function AppBreadcrumb() {
  const pathname = usePathname()
  const current =
    allNavItems.find((item) => item.url === pathname) ?? navMain[0]
  const inTestGroup = navTest.items.some((item) => item.url === pathname)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href="/">shadcn starter</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        {inTestGroup && (
          <>
            <BreadcrumbItem className="hidden md:block">
              {navTest.title}
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbPage>{current.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
