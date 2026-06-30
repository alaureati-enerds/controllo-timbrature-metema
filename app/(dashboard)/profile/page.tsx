import type { Metadata } from "next"

import { AccountSecurity } from "@/components/profile/account-security"
import { ProfileForm } from "@/components/profile/profile-form"
import { requireUser } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Profilo" }

export default async function ProfilePage() {
  const session = await requireUser()
  const { name, email, role, emailVerified, image } = session.user
  const twoFactorEnabled = Boolean(
    (session.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled
  )
  const roles = (role ?? "user").split(",").map((r) => r.trim())

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profilo</h1>
        <p className="text-sm text-muted-foreground">
          I tuoi dati personali e la sicurezza dell&apos;account.
        </p>
      </header>

      <ProfileForm
        initialName={name}
        email={email}
        image={image ?? null}
        roles={roles}
      />
      <AccountSecurity
        currentEmail={email}
        emailVerified={Boolean(emailVerified)}
        twoFactorEnabled={twoFactorEnabled}
      />
    </div>
  )
}
