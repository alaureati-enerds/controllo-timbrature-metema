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

// Impostazioni per dipendente: obbligo rapportino (segnala i giorni feriali
// già trascorsi senza rapportino come anomalia "Rapportino mancante" nella
// vista Timbrature) e visibilità nella select della stessa pagina (un
// dipendente nascosto non compare più tra quelli selezionabili, ma resta
// gestibile qui per poterlo rimostrare).
export function DipendentiSettingsForm({
  dipendenti,
  richiesti,
  nascosti,
}: {
  dipendenti: Dipendente[]
  richiesti: string[]
  nascosti: string[]
}) {
  const [attivi, setAttivi] = useState<Set<string>>(new Set(richiesti))
  const [nascostiSet, setNascostiSet] = useState<Set<string>>(
    new Set(nascosti)
  )
  const [busy, setBusy] = useState<string | null>(null)

  async function toggleRapportino(dipendente: Dipendente, richiesto: boolean) {
    const key = `${dipendente.codice}:rapportino`
    setBusy(key)
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

  async function toggleNascosto(dipendente: Dipendente, nascosto: boolean) {
    const key = `${dipendente.codice}:nascosto`
    setBusy(key)
    const precedente = nascostiSet.has(dipendente.codice)
    setNascostiSet((prev) => {
      const next = new Set(prev)
      if (nascosto) next.add(dipendente.codice)
      else next.delete(dipendente.codice)
      return next
    })
    try {
      const res = await fetch("/api/admin/dipendenti-nascosti", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dipendente: dipendente.codice, nascosto }),
      })
      if (!res.ok) throw new Error(await readError(res))
    } catch (error) {
      setNascostiSet((prev) => {
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
        <CardTitle>Dipendenti</CardTitle>
        <CardDescription>
          Obbligo di rapportino e visibilità di ciascun dipendente nella
          pagina Timbrature.
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
                      <TableHead className="w-40 text-right">
                        Nascondi dalla lista
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dipendenti.map((d) => {
                      const nome = d.descrizione || d.codice
                      return (
                        <TableRow key={d.codice}>
                          <TableCell className="font-medium">
                            {nome}
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={attivi.has(d.codice)}
                              disabled={busy === `${d.codice}:rapportino`}
                              aria-label={`Rapportino obbligatorio per ${nome}`}
                              onCheckedChange={(checked) =>
                                toggleRapportino(d, checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={nascostiSet.has(d.codice)}
                              disabled={busy === `${d.codice}:nascosto`}
                              aria-label={`Nascondi ${nome} dalla lista Timbrature`}
                              onCheckedChange={(checked) =>
                                toggleNascosto(d, checked)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile: card list */}
            <div className="flex flex-col gap-3 px-4 pb-4 md:hidden">
              {dipendenti.map((d) => {
                const nome = d.descrizione || d.codice
                return (
                  <Card key={d.codice} size="sm">
                    <CardContent className="flex flex-col gap-3 p-4">
                      <span className="font-medium">{nome}</span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                          Rapportino obbligatorio
                        </span>
                        <Switch
                          checked={attivi.has(d.codice)}
                          disabled={busy === `${d.codice}:rapportino`}
                          aria-label={`Rapportino obbligatorio per ${nome}`}
                          onCheckedChange={(checked) =>
                            toggleRapportino(d, checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                          Nascondi dalla lista
                        </span>
                        <Switch
                          checked={nascostiSet.has(d.codice)}
                          disabled={busy === `${d.codice}:nascosto`}
                          aria-label={`Nascondi ${nome} dalla lista Timbrature`}
                          onCheckedChange={(checked) =>
                            toggleNascosto(d, checked)
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
