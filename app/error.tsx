"use client"

import { useEffect } from "react"
import { HomeIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// Error boundary di route: Next la mostra quando un Server o Client Component
// lancia un errore non gestito durante il rendering. Deve essere un Client
// Component e riceve `reset()` per ritentare il rendering del segmento.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // In produzione qui andrebbe l'invio a un servizio di error tracking
    // (es. Sentry). Per ora resta su console finché non c'è osservabilità.
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-svh place-items-center p-6">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Qualcosa è andato storto</EmptyTitle>
          <EmptyDescription>
            Si è verificato un errore imprevisto. Riprova; se il problema
            persiste, torna alla home.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex justify-center gap-2">
            <Button onClick={reset}>
              <RotateCwIcon />
              Riprova
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                <HomeIcon />
                Home
              </Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </main>
  )
}
