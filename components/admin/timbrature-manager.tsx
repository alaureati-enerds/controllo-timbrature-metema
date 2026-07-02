"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { endOfMonth, format } from "date-fns"
import { it } from "date-fns/locale"
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import type { Dipendente } from "@/lib/mysql/timbrature"
import type { Giornata } from "@/app/api/admin/timbrature/route"

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
]

function meseCorrente() {
  const oggi = new Date()
  return {
    mese: oggi.getDate() <= 15
      ? (oggi.getMonth() === 0 ? 11 : oggi.getMonth() - 1)
      : oggi.getMonth(),
    anno: oggi.getDate() <= 15 && oggi.getMonth() === 0
      ? oggi.getFullYear() - 1
      : oggi.getFullYear(),
  }
}

function formattaMinuti(minuti: number): string {
  if (minuti === 0) return "—"
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${h}h ${m}m`
}

export function TimbratureManager() {
  const def = meseCorrente()
  const [mese, setMese] = useState(def.mese)
  const [anno, setAnno] = useState(def.anno)
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([])
  const [dipendente, setDipendente] = useState<Dipendente | null>(null)
  const [giornate, setGiornate] = useState<Giornata[]>([])
  const [orario, setOrario] = useState({
    primoIngresso: "08:00",
    primaUscita: "12:00",
    secondoIngresso: "13:30",
    secondaUscita: "17:30",
  })
  const [loading, setLoading] = useState(false)
  const [loadingDip, setLoadingDip] = useState(false)

  useEffect(() => {
    setLoadingDip(true)
    fetch("/api/admin/timbrature/dipendenti")
      .then((res) => res.json())
      .then((data) => {
        setDipendenti(data as Dipendente[])
        setLoadingDip(false)
      })
      .catch(() => {
        toast.error("Impossibile caricare i dipendenti")
        setLoadingDip(false)
      })
  }, [])

  const carica = useCallback(() => {
    if (!dipendente) return
    setLoading(true)
    const params = new URLSearchParams({
      dipendente: dipendente.codice,
      mese: String(mese + 1),
      anno: String(anno),
    })
    fetch(`/api/admin/timbrature?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((data: { giornate: Giornata[]; orario: typeof orario }) => {
        setGiornate(data.giornate)
        setOrario(data.orario)
        setLoading(false)
      })
      .catch(() => {
        toast.error("Impossibile caricare le timbrature")
        setLoading(false)
      })
  }, [dipendente, mese, anno])

  const totaleMese = useMemo(
    () => giornate.reduce((sum, g) => sum + g.totaleMinuti, 0),
    [giornate]
  )

  const meseLabel = `${MESI[mese]} ${anno}`

  function meseSu() {
    if (mese === 11) { setMese(0); setAnno((a) => a + 1) }
    else setMese((m) => m + 1)
  }
  function meseGiu() {
    if (mese === 0) { setMese(11); setAnno((a) => a - 1) }
    else setMese((m) => m - 1)
  }

  const weekEnd = (g: string) => {
    const d = new Date(g + "T12:00:00")
    return d.getDay() === 0 || d.getDay() === 6
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium">
                Dipendente
              </label>
              <Combobox
                items={dipendenti}
                value={dipendente}
                onValueChange={setDipendente}
                itemToStringValue={(d) => d.descrizione || d.codice}
              >
                <ComboboxTrigger
                  render={
                    <Button
                      variant="outline"
                      className="w-full justify-between font-normal"
                      disabled={loadingDip}
                    />
                  }
                >
                  <ComboboxValue placeholder={loadingDip ? "Caricamento..." : "Seleziona dipendente"} />
                </ComboboxTrigger>
                <ComboboxContent>
                  <ComboboxInput showTrigger={false} placeholder="Cerca dipendente..." />
                  <ComboboxEmpty>Nessun dipendente trovato.</ComboboxEmpty>
                  <ComboboxList>
                    {(d) => (
                      <ComboboxItem key={d.codice} value={d}>
                        {d.descrizione || d.codice}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            <div className="flex items-end gap-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Periodo
                </label>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={meseGiu}>
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-40 justify-start font-normal tabular-nums"
                    disabled
                  >
                    <CalendarIcon data-icon="inline-start" />
                    {meseLabel}
                  </Button>
                  <Button variant="outline" size="icon" onClick={meseSu}>
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>

              <Button onClick={carica} disabled={!dipendente || loading}>
                {loading ? <Spinner aria-hidden="true" /> : <SearchIcon data-icon="inline-start" />}
                Carica
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="tabular-nums">{meseLabel}</span>
            {giornate.length > 0 && (
              <span className="text-base font-normal text-muted-foreground tabular-nums">
                Totale mese: {formattaMinuti(totaleMese)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:px-6 sm:pb-6">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !dipendente ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Seleziona un dipendente e clicca <strong>Carica</strong> per
              visualizzare le timbrature.
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28 tabular-nums">Giorno</TableHead>
                        <TableHead className="w-20 text-center tabular-nums">
                          {orario.primoIngresso}
                        </TableHead>
                        <TableHead className="w-20 text-center tabular-nums">
                          {orario.primaUscita}
                        </TableHead>
                        <TableHead className="w-20 text-center tabular-nums">
                          {orario.secondoIngresso}
                        </TableHead>
                        <TableHead className="w-20 text-center tabular-nums">
                          {orario.secondaUscita}
                        </TableHead>
                        <TableHead className="w-24 text-right tabular-nums">
                          Totale
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {giornate.map((g) => {
                        const we = weekEnd(g.giorno)
                        return (
                          <TableRow
                            key={g.giorno}
                            className={cn(
                              we && "bg-destructive/10"
                            )}
                          >
                            <TableCell
                              className={cn(
                                "tabular-nums",
                                we && "text-destructive"
                              )}
                            >
                              {format(new Date(g.giorno + "T12:00:00"), "EEE dd/MM", { locale: it })}
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {g.entrata1 ?? (we ? "—" : "")}
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {g.uscita1 ?? (we ? "—" : "")}
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {g.entrata2 ?? (we ? "—" : "")}
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {g.uscita2 ?? (we ? "—" : "")}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right tabular-nums",
                                g.totaleMinuti > 0 &&
                                  g.totaleMinuti < 5 * 60 &&
                                  "text-muted-foreground",
                                g.totaleMinuti === 0 && !we && "text-muted-foreground"
                              )}
                            >
                              {formattaMinuti(g.totaleMinuti)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {giornate.map((g) => {
                  const we = weekEnd(g.giorno)
                  return (
                    <Card
                      key={g.giorno}
                      size="sm"
                      className={cn(we && "bg-destructive/10")}
                    >
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={cn(
                              "text-sm font-medium tabular-nums",
                              we && "text-destructive"
                            )}
                          >
                            {format(new Date(g.giorno + "T12:00:00"), "EEE dd/MM", { locale: it })}
                          </span>
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              g.totaleMinuti === 0 && !we && "text-muted-foreground",
                              g.totaleMinuti > 0 &&
                                g.totaleMinuti < 5 * 60 &&
                                "text-muted-foreground",
                              we && "text-destructive"
                            )}
                          >
                            {formattaMinuti(g.totaleMinuti)}
                          </span>
                        </div>
                        {!we && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              1° turno: {g.entrata1 ?? "—"} – {g.uscita1 ?? "—"}
                            </span>
                            <span>
                              2° turno: {g.entrata2 ?? "—"} – {g.uscita2 ?? "—"}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
