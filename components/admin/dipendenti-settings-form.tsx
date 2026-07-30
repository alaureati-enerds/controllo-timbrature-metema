"use client"

import { useState } from "react"
import { ClipboardListIcon, EyeOffIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
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

function pluraleDipendenti(n: number): string {
  return n === 1 ? "1 dipendente" : `${n} dipendenti`
}

type Campo = "rapportino" | "nascosto"

const ENDPOINT: Record<Campo, string> = {
  rapportino: "/api/admin/dipendenti-rapportino",
  nascosto: "/api/admin/dipendenti-nascosti",
}

const CHIAVE_BODY: Record<Campo, string> = {
  rapportino: "richiesto",
  nascosto: "nascosto",
}

// Impostazioni per dipendente: obbligo rapportino (segnala i giorni feriali
// già trascorsi senza rapportino come anomalia "Rapportino mancante" nella
// vista Timbrature) e visibilità nella select della stessa pagina (un
// dipendente nascosto non compare più tra quelli selezionabili, ma resta
// gestibile qui per poterlo rimostrare). Le righe si possono selezionare con
// una checkbox per modificarle in blocco, com'è già lo stile delle azioni di
// massa sulle giornate in TimbratureManager.
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  // Conferma delle azioni di massa. Il contenuto del dialog sta in uno stato
  // separato dall'`open`: confermando si svuota la selezione, e un testo
  // legato a `selected.size` direbbe «0 dipendenti» durante la chiusura.
  type Conferma = { campo: Campo; valore: boolean; n: number }
  const [conferma, setConferma] = useState<Conferma | null>(null)
  const [confermaOpen, setConfermaOpen] = useState(false)

  function chiediConferma(c: Conferma) {
    setConferma(c)
    setConfermaOpen(true)
  }

  function setPerCampo(campo: Campo) {
    return campo === "rapportino" ? setAttivi : setNascostiSet
  }

  async function toggleUno(campo: Campo, codice: string, valore: boolean) {
    const setState = setPerCampo(campo)
    const key = `${codice}:${campo}`
    setBusy(key)
    const insiemeAttuale = campo === "rapportino" ? attivi : nascostiSet
    const precedente = insiemeAttuale.has(codice)
    setState((prev) => {
      const next = new Set(prev)
      if (valore) next.add(codice)
      else next.delete(codice)
      return next
    })
    try {
      const res = await fetch(ENDPOINT[campo], {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dipendente: codice,
          [CHIAVE_BODY[campo]]: valore,
        }),
      })
      if (!res.ok) throw new Error(await readError(res))
    } catch (error) {
      setState((prev) => {
        const next = new Set(prev)
        if (precedente) next.add(codice)
        else next.delete(codice)
        return next
      })
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setBusy(null)
    }
  }

  function toggleSelect(codice: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(codice)) next.delete(codice)
      else next.add(codice)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === dipendenti.length
        ? new Set()
        : new Set(dipendenti.map((d) => d.codice))
    )
  }

  async function applicaBulk(campo: Campo, valore: boolean) {
    const codici = Array.from(selected)
    setBulkBusy(true)
    const risultati = await Promise.allSettled(
      codici.map((codice) =>
        fetch(ENDPOINT[campo], {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dipendente: codice,
            [CHIAVE_BODY[campo]]: valore,
          }),
        }).then((res) => {
          if (!res.ok) throw new Error()
          return codice
        })
      )
    )
    const riusciti = risultati
      .filter(
        (r): r is PromiseFulfilledResult<string> => r.status === "fulfilled"
      )
      .map((r) => r.value)
    const falliti = risultati.length - riusciti.length

    const setState = setPerCampo(campo)
    setState((prev) => {
      const next = new Set(prev)
      for (const codice of riusciti) {
        if (valore) next.add(codice)
        else next.delete(codice)
      }
      return next
    })

    if (falliti > 0) {
      toast.error(
        falliti === 1
          ? "1 dipendente non aggiornato"
          : `${falliti} dipendenti non aggiornati`
      )
    }
    if (riusciti.length > 0) {
      const etichetta =
        campo === "rapportino"
          ? valore
            ? "Rapportino obbligatorio attivato"
            : "Rapportino obbligatorio disattivato"
          : valore
            ? "Dipendenti nascosti dalla lista Timbrature"
            : "Dipendenti rimostrati nella lista Timbrature"
      toast.success(`${etichetta} per ${pluraleDipendenti(riusciti.length)}`)
    }

    setBulkBusy(false)
    setSelected(new Set())
  }

  const nSelezionate = selected.size

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dipendenti</CardTitle>
        <CardDescription>
          Obbligo di rapportino e visibilità di ciascun dipendente nella
          pagina Timbrature. Seleziona più righe per modificarle insieme.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-0 sm:px-6 sm:pb-6">
        {dipendenti.length === 0 ? (
          <p className="px-6 py-4 text-center text-sm text-muted-foreground">
            Nessun dipendente trovato.
          </p>
        ) : (
          <>
            {/* Barra di contesto → azioni di massa quando c'è una selezione,
                stesso pattern delle giornate in TimbratureManager. */}
            {nSelezionate > 0 && (
              <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 px-4 sm:px-0">
                <div className="flex items-center gap-1">
                  <span className="font-medium tabular-nums">
                    {pluraleDipendenti(nSelezionate)} selezionat
                    {nSelezionate === 1 ? "o" : "i"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setSelected(new Set())}
                  >
                    <XIcon data-icon="inline-start" />
                    Annulla selezione
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={bulkBusy}>
                        {bulkBusy ? (
                          <Spinner aria-hidden="true" />
                        ) : (
                          <ClipboardListIcon data-icon="inline-start" />
                        )}
                        Rapportino obbligatorio
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          chiediConferma({
                            campo: "rapportino",
                            valore: true,
                            n: nSelezionate,
                          })
                        }
                      >
                        Attiva per i selezionati
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          chiediConferma({
                            campo: "rapportino",
                            valore: false,
                            n: nSelezionate,
                          })
                        }
                      >
                        Disattiva per i selezionati
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={bulkBusy}>
                        {bulkBusy ? (
                          <Spinner aria-hidden="true" />
                        ) : (
                          <EyeOffIcon data-icon="inline-start" />
                        )}
                        Nascondi dalla lista
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          chiediConferma({
                            campo: "nascosto",
                            valore: true,
                            n: nSelezionate,
                          })
                        }
                      >
                        Nascondi i selezionati
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          chiediConferma({
                            campo: "nascosto",
                            valore: false,
                            n: nSelezionate,
                          })
                        }
                      >
                        Mostra i selezionati
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}

            {/* Desktop: tabella */}
            <div className="hidden md:block">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center">
                        <Checkbox
                          checked={
                            dipendenti.length > 0 &&
                            selected.size === dipendenti.length
                          }
                          onCheckedChange={toggleSelectAll}
                          aria-label="Seleziona tutto"
                        />
                      </TableHead>
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
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selected.has(d.codice)}
                              onCheckedChange={() => toggleSelect(d.codice)}
                              aria-label={`Seleziona ${nome}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {nome}
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={attivi.has(d.codice)}
                              disabled={busy === `${d.codice}:rapportino`}
                              aria-label={`Rapportino obbligatorio per ${nome}`}
                              onCheckedChange={(checked) =>
                                toggleUno("rapportino", d.codice, checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={nascostiSet.has(d.codice)}
                              disabled={busy === `${d.codice}:nascosto`}
                              aria-label={`Nascondi ${nome} dalla lista Timbrature`}
                              onCheckedChange={(checked) =>
                                toggleUno("nascosto", d.codice, checked)
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
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selected.has(d.codice)}
                          onCheckedChange={() => toggleSelect(d.codice)}
                          aria-label={`Seleziona ${nome}`}
                        />
                        <span className="font-medium">{nome}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                          Rapportino obbligatorio
                        </span>
                        <Switch
                          checked={attivi.has(d.codice)}
                          disabled={busy === `${d.codice}:rapportino`}
                          aria-label={`Rapportino obbligatorio per ${nome}`}
                          onCheckedChange={(checked) =>
                            toggleUno("rapportino", d.codice, checked)
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
                            toggleUno("nascosto", d.codice, checked)
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

      <AlertDialog open={confermaOpen} onOpenChange={setConfermaOpen}>
        <AlertDialogContent>
          {conferma && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {conferma.campo === "rapportino"
                    ? conferma.valore
                      ? `Attivare l'obbligo di rapportino per ${pluraleDipendenti(conferma.n)}?`
                      : `Disattivare l'obbligo di rapportino per ${pluraleDipendenti(conferma.n)}?`
                    : conferma.valore
                      ? `Nascondere ${pluraleDipendenti(conferma.n)} dalla lista Timbrature?`
                      : `Mostrare di nuovo ${pluraleDipendenti(conferma.n)} nella lista Timbrature?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {conferma.campo === "rapportino"
                    ? "La vista Timbrature segnalerà (o smetterà di segnalare) i giorni senza rapportino per questi dipendenti."
                    : conferma.valore
                      ? "Questi dipendenti non saranno più selezionabili nella pagina Timbrature, finché non li rendi di nuovo visibili da qui."
                      : "Questi dipendenti torneranno selezionabili nella select della pagina Timbrature."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => applicaBulk(conferma.campo, conferma.valore)}
                >
                  Conferma
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
