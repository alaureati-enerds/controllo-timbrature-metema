import type { Metadata } from "next"
import { Suspense } from "react"

import { TwoFactorForm } from "@/components/auth/two-factor-form"

export const metadata: Metadata = { title: "Verifica in due passaggi" }

export default function TwoFactorPage() {
  return (
    <Suspense>
      <TwoFactorForm />
    </Suspense>
  )
}
