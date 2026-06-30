"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronRightIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { initials } from "@/lib/initials"
import { adminNavItems, navItems } from "@/lib/navigation"
import { hasRole } from "@/lib/roles"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"

function MenuSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-lg border">
        {children}
      </div>
    </section>
  )
}

function MenuRow({
  href,
  icon: Icon,
  children,
}: {
  href: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 text-sm transition-colors hover:bg-accent"
    >
      <Icon
        aria-hidden="true"
        className="size-5 shrink-0 text-muted-foreground"
      />
      <span className="flex-1 truncate">{children}</span>
      <ChevronRightIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    </Link>
  )
}

// Contenuto della pagina /menu: la navigazione completa per il mobile (la
// bottom bar mostra solo 4 scorciatoie). Replica le sezioni della sidebar
// (Piattaforma, Amministrazione) più le azioni dell'account.
export function MobileMenu() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const user = session?.user
  const isAdmin = hasRole(user?.role, "admin")

  async function handleSignOut() {
    await authClient.signOut()
    toast.success("Disconnesso")
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <Avatar className="size-11 rounded-lg">
          {user?.image && (
            <AvatarImage src={user.image} alt="" className="rounded-lg" />
          )}
          <AvatarFallback className="rounded-lg">
            {initials(user?.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          {isPending ? (
            <>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-1 h-3 w-40" />
            </>
          ) : (
            <>
              <span className="truncate font-medium">
                {user?.name ?? "Ospite"}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {user?.email ?? "—"}
              </span>
            </>
          )}
        </div>
      </div>

      <MenuSection label="Piattaforma">
        {navItems.map((item) => (
          <MenuRow key={item.url} href={item.url} icon={item.icon}>
            {item.title}
          </MenuRow>
        ))}
      </MenuSection>

      {isAdmin && (
        <MenuSection label="Amministrazione">
          {adminNavItems.map((item) => (
            <MenuRow key={item.url} href={item.url} icon={item.icon}>
              {item.title}
            </MenuRow>
          ))}
        </MenuSection>
      )}

      <MenuSection label="Account">
        <MenuRow href="/profile" icon={UserIcon}>
          Profilo
        </MenuRow>
        <MenuRow href="/settings" icon={SettingsIcon}>
          Impostazioni
        </MenuRow>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 p-3 text-left text-sm transition-colors hover:bg-accent"
        >
          <LogOutIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
          />
          <span className="flex-1">Esci</span>
        </button>
      </MenuSection>
    </div>
  )
}
