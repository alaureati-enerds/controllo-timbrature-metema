import type { Metadata } from "next"

import { UserDetail } from "@/components/admin/user-detail"
import { requireRole } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Dettaglio utente" }

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireRole("admin")
  const { id } = await params

  return (
    <div className="flex flex-col gap-6">
      <UserDetail userId={id} currentUserId={session.user.id} />
    </div>
  )
}
