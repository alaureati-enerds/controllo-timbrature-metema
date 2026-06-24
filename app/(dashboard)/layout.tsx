import { cookies } from "next/headers"

import { AppBreadcrumb } from "@/components/app-breadcrumb"
import { AppSidebar } from "@/components/app-sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

// Shell della dashboard: sidebar a sinistra + header con trigger e breadcrumb.
// Tutte le pagine sotto (dashboard) ne ereditano la struttura.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Ripristina lo stato aperto/chiuso della sidebar dal cookie scritto dal
  // componente, così al reload non riparte sempre aperta (niente flash).
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        {/* Skip link: scorciatoia da tastiera per saltare sidebar e topbar e
            arrivare diretti al contenuto. Visibile solo quando riceve il focus. */}
        <a
          href="#main-content"
          className="sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Vai al contenuto
        </a>
        <AppSidebar />
        <SidebarInset id="main-content">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <AppBreadcrumb />
            <div className="ml-auto">
              <ModeToggle />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
