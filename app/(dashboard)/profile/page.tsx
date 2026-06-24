import type { Metadata } from "next"

import { AccountSecurity } from "@/components/profile/account-security"
import { ProfileForm } from "@/components/profile/profile-form"
import { requireUser } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Profilo" }

export default async function ProfilePage() {
  const session = await requireUser()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profilo</h1>
        <p className="text-sm text-muted-foreground">
          Gestisci i tuoi dati, la password e la sicurezza dell&apos;account.
        </p>
      </header>
      <ProfileForm initialName={session.user.name} email={session.user.email} />
      <AccountSecurity currentEmail={session.user.email} />
    </div>
  )
}
