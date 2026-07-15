import { cookies } from "next/headers"
import Link from "next/link"

import { AppBreadcrumb } from "@/components/app-breadcrumb"
import { AppSidebar } from "@/components/app-sidebar"
import { BrandingIcon } from "@/components/branding-icon"
import { GlobalSearch } from "@/components/global-search"
import { ImpersonationBanner } from "@/components/impersonation-banner"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { ModeToggle } from "@/components/mode-toggle"
import { NotificationsBell } from "@/components/notifications-bell"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { toPublicSettings } from "@/lib/settings/schema"
import { getSystemSettings } from "@/lib/settings/system"

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

  // Branding globale per l'header della sidebar (solo i campi pubblici).
  const branding = toPublicSettings(await getSystemSettings())

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        {/* Skip link: scorciatoia da tastiera per saltare sidebar e topbar e
            arrivare diretti al contenuto. Visibile solo quando riceve il focus. */}
        <a
          href="#main-content"
          className="sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Vai al contenuto
        </a>
        <AppSidebar branding={branding} />
        <SidebarInset id="main-content">
          {/* Topbar sticky: resta in alto durante lo scroll. Il `pt` di
              safe-area sta sul contenitore sticky (non sull'header) così copre
              anche l'ImpersonationBanner e riempie la zona sotto il notch in
              Safari (in PWA standalone l'inset vale 0). `bg-background` evita
              che il contenuto traspaia sotto la barra mentre si scorre. */}
          <div className="sticky top-0 z-10 bg-background pt-[env(safe-area-inset-top)]">
            <ImpersonationBanner />
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 md:h-16 md:px-4">
              {/* Hamburger + separatore solo da desktop: su mobile la
                  navigazione è affidata alla bottom bar, non alla sidebar. */}
              <SidebarTrigger className="-ml-1 hidden md:flex" />
              <Separator
                orientation="vertical"
                className="mr-2 hidden data-[orientation=vertical]:h-4 md:block"
              />
              {/* Mobile: branding a sinistra (la sidebar che lo mostra è
                  nascosta). Desktop: breadcrumb come di consueto. */}
              <Link
                href="/"
                className="flex min-w-0 touch-manipulation items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden"
              >
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <BrandingIcon name={branding.iconName} className="size-4" />
                </div>
                <span className="truncate font-semibold">
                  {branding.appName}
                </span>
              </Link>
              <div className="hidden min-w-0 md:flex">
                <AppBreadcrumb appName={branding.appName} />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <GlobalSearch />
                <NotificationsBell />
                {/* Selettore tema solo su desktop: su mobile è nelle
                    impostazioni utente. */}
                <div className="hidden md:flex">
                  <ModeToggle />
                </div>
              </div>
            </header>
          </div>
          {/* `pb` mobile: lascia spazio per la bottom bar (h-14) + safe-area,
              così l'ultimo contenuto non finisce sotto la barra. Su desktop la
              barra è nascosta, quindi padding normale. */}
          <div className="flex flex-1 flex-col gap-4 p-4 pb-[calc(4.5rem+min(env(safe-area-inset-bottom),0.5rem))] md:pb-4">
            {children}
          </div>
          <MobileBottomNav />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
