import { HomeIcon, SearchXIcon } from "lucide-react"
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

// Pagina 404: Next la mostra quando una route non esiste o quando il codice
// chiama notFound(). Vive dentro il root layout, quindi eredita tema e font.
export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>Pagina non trovata</EmptyTitle>
          <EmptyDescription>
            La pagina che cerchi non esiste o è stata spostata.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/">
              <HomeIcon />
              Torna alla home
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
