import Link from "next/link"
import { FileQuestionIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// Mostrata quando una pagina della dashboard invoca notFound().
export default function DashboardNotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestionIcon />
        </EmptyMedia>
        <EmptyTitle>Pagina non trovata</EmptyTitle>
        <EmptyDescription>
          La pagina che stai cercando non esiste o è stata spostata.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/">Torna alla dashboard</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
