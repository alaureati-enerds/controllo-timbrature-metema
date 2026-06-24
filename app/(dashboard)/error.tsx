"use client"

import { useEffect } from "react"
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// Boundary degli errori per le pagine della dashboard: cattura le eccezioni
// lanciate durante il render e mostra una UI di recupero (con "Riprova").
// Deve essere un Client Component.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Qualcosa è andato storto</EmptyTitle>
        <EmptyDescription>
          {error.message || "Si è verificato un errore imprevisto."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={reset}>
          <RotateCcwIcon data-icon="inline-start" />
          Riprova
        </Button>
      </EmptyContent>
    </Empty>
  )
}
