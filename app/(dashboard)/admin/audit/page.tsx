import type { Metadata } from "next"

import { AuditLog } from "@/components/admin/audit-log"
import { requireRole } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Audit log" }

export default async function AdminAuditPage() {
  await requireRole("admin")

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Audit log
        </h1>
        <p className="text-sm text-muted-foreground">
          Registro delle azioni di sicurezza: chi ha fatto cosa, quando e da dove.
        </p>
      </header>

      <AuditLog />
    </div>
  )
}
