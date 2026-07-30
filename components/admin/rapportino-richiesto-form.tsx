"use client"

import { useState } from "react"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Dipendente } from "@/lib/mysql/timbrature"

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  return data?.error ?? "Operazione non riuscita"
}

// Elenco dei dipendenti con lo switch "rapportino obbligatorio": quando
// attivo, un giorno feriale già trascorso senza rapportino compare come
// anomalia "Rapportino mancante" nella vista Timbrature (badge, tinta riga,
// tab "Da verificare"), esattamente come le altre anomalie di quella pagina.
export function RapportinoRichiestoForm({
  dipendenti,
  richiesti,
}: {
  dipendenti: Dipendente[]
  richiesti: string[]
}) {
  const [attivi, setAttivi] = useState<Set<string>>(new Set(richiesti))
  const [busy, setBusy] = useState<string | null>(null)

  async function toggle(dipendente: Dipendente, richiesto: boolean) {
    setBusy(dipendente.codice)
    const precedente = attivi.has(dipendente.codice)
    setAttivi((prev) => {
      const next = new Set(prev)
      if (richiesto) next.add(dipendente.codice)
      else next.delete(dipendente.codice)
      return next
    })
    try {
      const res = await fetch("/api/admin/dipendenti-rapportino", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dipendente: dipendente.codice, richiesto }),
      })
      if (!res.ok) throw new Error(await readError(res))
    } catch (error) {
      setAttivi((prev) => {
        const next = new Set(prev)
        if (precedente) next.add(dipendente.codice)
        else next.delete(dipendente.codice)
        return next
      })
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Obbligo rapportino</CardTitle>
        <CardDescription>
          Dipendenti per cui la vista Timbrature segnala i giorni senza
          rapportino, come le altre anomalie da verificare.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:px-6 sm:pb-6">
        {dipendenti.length === 0 ? (
          <p className="px-6 py-4 text-center text-sm text-muted-foreground">
            Nessun dipendente trovato.
          </p>
        ) : (
          <>
            {/* Desktop: tabella */}
            <div className="hidden md:block">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dipendente</TableHead>
                      <TableHead className="w-40 text-right">
                        Rapportino obbligatorio
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dipendenti.map((d) => (
                      <TableRow key={d.codice}>
                        <TableCell className="font-medium">
                          {d.descrizione || d.codice}
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={attivi.has(d.codice)}
                            disabled={busy === d.codice}
                            aria-label={`Rapportino obbligatorio per ${d.descrizione || d.codice}`}
                            onCheckedChange={(checked) => toggle(d, checked)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile: card list */}
            <div className="flex flex-col gap-3 px-4 pb-4 md:hidden">
              {dipendenti.map((d) => (
                <Card key={d.codice} size="sm">
                  <CardContent className="flex items-center justify-between gap-2 p-4">
                    <span className="font-medium">
                      {d.descrizione || d.codice}
                    </span>
                    <Switch
                      checked={attivi.has(d.codice)}
                      disabled={busy === d.codice}
                      aria-label={`Rapportino obbligatorio per ${d.descrizione || d.codice}`}
                      onCheckedChange={(checked) => toggle(d, checked)}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
