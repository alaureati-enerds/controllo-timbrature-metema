"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BoxIcon, ChevronRightIcon, PuzzleIcon } from "lucide-react"

import { authClient } from "@/lib/auth-client"
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

// Nome e logo arrivano dalle impostazioni di sistema, lette server-side nel
// layout della dashboard e passate come prop (questo è un client component).
export function AppSidebar({
  appName,
  logoUrl,
}: {
  appName: string
  logoUrl: string | null
}) {
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const isAdmin = hasRole(session?.user.role, "admin")

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <BoxIcon aria-hidden="true" />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">{appName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Dashboard
                  </span>
                </div>
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
