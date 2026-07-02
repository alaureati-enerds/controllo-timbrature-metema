import type { Metadata } from "next"

import { UsersManager } from "@/components/admin/users-manager"
import { requireRole } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Gestione utenti" }

// Pagina riservata agli admin: la protezione server (requireRole) reindirizza
// chi non è admin. La UI sottostante usa le API admin di Better Auth.
export default async function AdminUsersPage() {
  await requireRole("admin")

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Gestione utenti
        </h1>
        <p className="text-sm text-muted-foreground">
          Crea utenti, assegna ruoli e gestisci l&apos;accesso.
        </p>
      </header>
      <UsersManager />
    </div>
  )
}
