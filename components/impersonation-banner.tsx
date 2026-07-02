"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { CircleStopIcon } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

// Banner globale mostrato quando l'admin sta impersonando un altro utente
// (session.session.impersonatedBy valorizzato). Permette di tornare al proprio
// account con "Stop".
export function ImpersonationBanner() {
  const router = useRouter()
  const { data } = authClient.useSession()
  const [busy, setBusy] = useState(false)

  if (!data?.session.impersonatedBy) return null

  async function stop() {
    setBusy(true)
    const { error } = await authClient.admin.stopImpersonating()
    setBusy(false)
    if (error) {
      toast.error(error.message ?? "Impossibile terminare l'impersonificazione")
      return
    }
    toast.success("Sei tornato al tuo account")
    router.push("/admin/users")
    router.refresh()
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        Stai impersonando <strong>{data.user.name}</strong> ({data.user.email})
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-amber-950/30 bg-amber-100 text-amber-950 hover:bg-amber-200"
        onClick={stop}
        disabled={busy}
      >
        {busy ? <Spinner /> : <CircleStopIcon data-icon="inline-start" />}
        Stop
      </Button>
    </div>
  )
}
