"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BoxIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
  PuzzleIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  DropdownMenuSeparator,
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
import { navItems } from "@/lib/navigation"
import { cn } from "@/lib/utils"

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
    <Collapsible asChild defaultOpen={hasActiveChild} className="group/collapsible">
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

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <BoxIcon aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">shadcn starter</span>
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
                      // Indicatore di voce attiva: una barretta a sinistra che
                      // distingue lo stato attivo dall'hover (che condividono lo
                      // stesso sfondo). Nascosta quando la sidebar è a icone.
                      className={cn(
                        isActive &&
                          "relative before:absolute before:top-1/2 before:left-0 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-sidebar-primary group-data-[collapsible=icon]:before:hidden"
                      )}
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
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip="Account">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">UT</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">Utente</span>
                    <span className="truncate text-xs text-muted-foreground">
                      utente@example.com
                    </span>
                  </div>
                  <ChevronsUpDownIcon
                    aria-hidden="true"
                    className="ml-auto group-data-[collapsible=icon]:hidden"
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-(--radix-dropdown-menu-trigger-width)"
              >
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <UserIcon aria-hidden="true" />
                    Profilo
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <SettingsIcon aria-hidden="true" />
                    Impostazioni
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOutIcon aria-hidden="true" />
                  Esci
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
