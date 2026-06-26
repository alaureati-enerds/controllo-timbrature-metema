"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BoxIcon, ChevronRightIcon, PuzzleIcon } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { BrandingIcon } from "@/components/branding-icon"
import { NavUser } from "@/components/nav-user"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { adminNavItems, navItems } from "@/lib/navigation"
import type { PublicSystemSettings } from "@/lib/settings/schema"

// `user.role` può contenere più ruoli separati da virgola.
function hasRole(role: string | null | undefined, target: string) {
  return (role ?? "")
    .split(",")
    .map((r) => r.trim())
    .includes(target)
}

// Sotto-voci della voce dimostrativa "Esempio".
const exampleSubItems = [
  { title: "Sotto-voce 1", url: "/notes" },
  { title: "Sotto-voce 2", url: "/demo" },
]

// Voce di menu con sotto-menu che resta navigabile in entrambi gli stati della
// sidebar. Espansa: fisarmonica inline (Collapsible + SidebarMenuSub). Collassata
// a icone: dropdown ancorato all'icona, perché in modalità "icon" il sotto-menu
// inline viene nascosto dal componente.
function NavExample() {
  const pathname = usePathname()
  const { state, isMobile } = useSidebar()

  // Apri la fisarmonica se la rotta corrente è una delle sotto-voci, così
  // l'utente vede subito dove si trova.
  const hasActiveChild = exampleSubItems.some((sub) => sub.url === pathname)

  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip="Esempio">
              <PuzzleIcon aria-hidden="true" />
              <span>Esempio</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-48">
            <DropdownMenuLabel>Esempio</DropdownMenuLabel>
            <DropdownMenuGroup>
              {exampleSubItems.map((sub) => (
                <DropdownMenuItem key={sub.url} asChild>
                  <Link href={sub.url}>{sub.title}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible
      asChild
      defaultOpen={hasActiveChild}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip="Esempio">
            <PuzzleIcon aria-hidden="true" />
            <span>Esempio</span>
            <ChevronRightIcon
              aria-hidden="true"
              className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {exampleSubItems.map((sub) => (
              <SidebarMenuSubItem key={sub.url}>
                <SidebarMenuSubButton asChild isActive={pathname === sub.url}>
                  <Link href={sub.url}>{sub.title}</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

// Il branding (nome, sottotitolo, modalità, icona, logo) arriva dalle
// impostazioni di sistema, lette server-side nel layout della dashboard e
// passate come prop (questo è un client component).
export function AppSidebar({ branding }: { branding: PublicSystemSettings }) {
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const isAdmin = hasRole(session?.user.role, "admin")

  // Logo personalizzato solo se la modalità è "logo" e un logo è stato caricato;
  // altrimenti si ricade sull'icona scelta + nome/sottotitolo.
  const useLogo = branding.brandingMode === "logo" && branding.logoFileId

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                {useLogo ? (
                  <>
                    {/* Sidebar aperta: logo a tutta larghezza. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/files/${branding.logoFileId}`}
                      alt={branding.appName}
                      className="h-8 w-full object-contain group-data-[collapsible=icon]:hidden"
                    />
                    {/* Sidebar collassata: icona di default quadrata. */}
                    <div className="hidden aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:flex">
                      <BoxIcon aria-hidden="true" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <BrandingIcon
                        name={branding.iconName}
                        className="size-4"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-semibold">
                        {branding.appName}
                      </span>
                      {branding.appSubtitle && (
                        <span className="truncate text-xs text-muted-foreground">
                          {branding.appSubtitle}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Piattaforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link
                        href={item.url}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}

              {/* Voce dimostrativa con sotto-menu. Da espansa si apre a
                  fisarmonica; da collassata (icon) diventa un dropdown ancorato
                  all'icona così le sotto-voci restano navigabili. Rimuovibile
                  quando non serve più. */}
              <NavExample />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sezione visibile solo agli amministratori. La protezione effettiva è
            comunque server-side nelle pagine (requireRole). */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Amministrazione</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => {
                  const isActive = pathname === item.url
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link
                          href={item.url}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <item.icon aria-hidden="true" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
