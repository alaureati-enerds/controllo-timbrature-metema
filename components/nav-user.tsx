"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

function initials(name?: string | null) {
  if (!name) return "??"
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

// Account dropdown della sidebar: mostra l'utente reale dalla sessione e gestisce
// il logout. Profilo/Impostazioni puntano alle relative pagine della dashboard.
export function NavUser() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  async function handleSignOut() {
    await authClient.signOut()
    toast.success("Disconnesso")
    router.push("/login")
    router.refresh()
  }

  if (isPending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-4 w-24 group-data-[collapsible=icon]:hidden" />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const user = session?.user

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip="Account">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {initials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">
                  {user?.name ?? "Ospite"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email ?? "—"}
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
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserIcon aria-hidden="true" />
                  Profilo
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <SettingsIcon aria-hidden="true" />
                  Impostazioni
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOutIcon aria-hidden="true" />
              Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
