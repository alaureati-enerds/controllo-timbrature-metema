import type { Metadata } from "next"
import { CheckCircle2Icon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Demo skeleton",
}

// Pagina dimostrativa: un ritardo artificiale fa "sospendere" il Server
// Component, così Next mostra il fallback loading.tsx (lo skeleton) per
// qualche secondo prima del contenuto. Serve solo a verificare il loading;
// rimuovi questa pagina (e la voce in lib/navigation.ts) quando non serve più.
const RITARDO_MS = 3000

export default async function DemoPage() {
  await new Promise((resolve) => setTimeout(resolve, RITARDO_MS))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Demo skeleton</h1>
        <p className="text-sm text-muted-foreground">
          Questa pagina attende {RITARDO_MS / 1000} secondi lato server: durante
          l&apos;attesa vedi lo skeleton di caricamento, poi compare questo contenuto.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4 text-muted-foreground" />
                Contenuto {i}
              </CardTitle>
              <CardDescription>Caricato dopo il ritardo simulato.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Se hai visto lo skeleton prima di questo testo, il fallback di
                caricamento funziona.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
