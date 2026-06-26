import type { Metadata } from "next"
import { BadgeCheckIcon } from "lucide-react"

import { AccountSecurity } from "@/components/profile/account-security"
import { ProfileForm } from "@/components/profile/profile-form"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { requireUser } from "@/lib/auth-helpers"
import { initials } from "@/lib/initials"

export const metadata: Metadata = { title: "Profilo" }

export default async function ProfilePage() {
  const session = await requireUser()
  const { name, email, role, emailVerified } = session.user
  const twoFactorEnabled = Boolean(
    (session.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled
  )
  const roles = (role ?? "user").split(",").map((r) => r.trim())

  return (
    <div className="flex flex-col gap-6">
      {/* Intestazione identità: avatar, nome e stato dell'account a tutta larghezza. */}
      <header className="flex flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground sm:flex-row sm:items-center sm:gap-5">
        <Avatar className="size-16 rounded-xl">
          <AvatarFallback className="rounded-xl text-lg font-medium">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="capitalize">
                {r}
              </Badge>
            ))}
            {emailVerified ? (
              <Badge variant="outline">
                <BadgeCheckIcon data-icon="inline-start" />
                Email verificata
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Email da verificare
              </Badge>
            )}
          </div>
        </div>
      </header>

      <ProfileForm initialName={name} email={email} />
      <AccountSecurity currentEmail={email} twoFactorEnabled={twoFactorEnabled} />
    </div>
  )
}
