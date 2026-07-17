"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { InfoIcon, MoonIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { RapportinoRigaCard } from "@/components/admin/rapportino-riga-card"
import { MESI, SelettorePeriodo } from "@/components/admin/selettore-periodo"
import type { Dipendente } from "@/lib/mysql/timbrature"
import type { RapportinoRiga } from "@/lib/mysql/rapportini"
import { raggruppaPerGiorno, sommaGiorno } from "@/lib/rapportini/calcolo"
import { CALCOLO_DEFAULTS } from "@/lib/settings/schema"
import type {
  CalcoloSettingsAdmin,
  OrarioLavoroSettingsAdmin,
} from "@/lib/settings/schema"
import {
  calcolaOreSplit,
  costruisciOrario,
  isWeekend,
} from "@/lib/timbrature/calcolo"
import type { Giornata } from "@/lib/timbrature/giornate"

// Pagina di sola lettura per validare l'incrocio timbrature/rapportini prima
// di toccare la pagina Timbrature vera e propria (vedi il piano della
// feature). Non scrive nulla: né correzioni né stato server-side.

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

function nomeGiorno(d: Date, formato: "EEE" | "EEEE"): string {
  return format(d, formato, { locale: it }).replace(/^./, (c) => c.toUpperCase())
}

function formattaMinuti(minuti: number): string {
  if (minuti === 0) return "—"
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${h}h ${m}m`
}

const COL_ORA = "w-14 px-1 text-center tabular-nums"

const THEAD_STICKY =
  "sticky z-10 bg-background shadow-[inset_0_-1px_0_var(--border)]"
const TFOOT_STICKY =
  "sticky bottom-0 z-10 bg-muted shadow-[inset_0_1px_0_var(--border)]"

type Riga = {
  giorno: string
  data: Date
  we: boolean
  grezzo: Giornata
  righeRapportino: RapportinoRiga[]
  lavoroMinuti: number
  viaggioMinuti: number
  pernottamento: boolean
  ordinario: number
  straordinarioLavoro: number
  straordinarioViaggio: number
  totale: number
  ricostruito: ReturnType<typeof costruisciOrario>
}

export function RapportiniManager() {
  const def = meseCorrente()
  const [mese, setMese] = useState(def.mese)
  const [anno, setAnno] = useState(def.anno)
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([])
  const [dipendente, setDipendente] = useState<Dipendente | null>(null)
  const [loadingDip, setLoadingDip] = useState(true)
  const [loading, setLoading] = useState(false)
  const [giornate, setGiornate] = useState<Giornata[]>([])
  const [rapportini, setRapportini] = useState<RapportinoRiga[]>([])
  const [orario, setOrario] = useState<OrarioLavoroSettingsAdmin>({
    primoIngresso: "08:00",
    primaUscita: "12:00",
    secondoIngresso: "13:30",
    secondaUscita: "17:30",
  })
  const [regole, setRegole] = useState<CalcoloSettingsAdmin>(CALCOLO_DEFAULTS)
  const [dettaglioGiorno, setDettaglioGiorno] = useState<string | null>(null)
  const richiestaRef = useRef(0)

  useEffect(() => {
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
    const richiesta = ++richiestaRef.current
    setLoading(true)
    const params = new URLSearchParams({
      dipendente: dipendente.codice,
      mese: String(mese + 1),
      anno: String(anno),
    })
    Promise.all([
      fetch(`/api/admin/timbrature?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      }),
      fetch(`/api/admin/rapportini?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      }),
    ])
      .then(
        ([timbratureData, rapportiniData]: [
          {
            giornate: Giornata[]
            orario: OrarioLavoroSettingsAdmin
            regole: CalcoloSettingsAdmin
          },
          { rapportini: RapportinoRiga[] },
        ]) => {
          if (richiesta !== richiestaRef.current) return
          setGiornate(timbratureData.giornate)
          setOrario(timbratureData.orario)
          setRegole(timbratureData.regole)
          setRapportini(rapportiniData.rapportini)
          setLoading(false)
        }
      )
      .catch(() => {
        if (richiesta !== richiestaRef.current) return
        toast.error("Impossibile caricare timbrature e rapportini")
        setLoading(false)
      })
  }, [dipendente, mese, anno])

  useEffect(() => {
    const timer = setTimeout(() => carica(), 0)
    return () => clearTimeout(timer)
  }, [carica])

  const meseLabel = `${MESI[mese]} ${anno}`
  const nomeDipendente = dipendente
    ? dipendente.descrizione || dipendente.codice
    : null

  const perGiorno = raggruppaPerGiorno(rapportini)
  const righe: Riga[] = giornate.map((g) => {
    const righeRapportino = perGiorno.get(g.giorno) ?? []
    const { lavoroMinuti, viaggioMinuti, pernottamento } =
      sommaGiorno(righeRapportino)
    const split = calcolaOreSplit(
      lavoroMinuti,
      viaggioMinuti,
      regole.minutiOrdinari
    )
    return {
      giorno: g.giorno,
      data: new Date(`${g.giorno}T00:00:00`),
      we: isWeekend(g.giornoSettimana),
      grezzo: g,
      righeRapportino,
      lavoroMinuti,
      viaggioMinuti,
      pernottamento,
      ordinario: split.ordinario,
      straordinarioLavoro: split.straordinarioLavoro,
      straordinarioViaggio: split.straordinarioViaggio,
      totale: split.totale,
      ricostruito: costruisciOrario(split.totale, orario),
    }
  })

  const rigaDettaglio = righe.find((r) => r.giorno === dettaglioGiorno) ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Combobox
          items={dipendenti}
          value={dipendente}
          onValueChange={setDipendente}
        >
          <ComboboxTrigger
            render={
              <Button
                variant="outline"
                className="w-full justify-between font-normal sm:w-64"
                aria-label={
                  nomeDipendente
                    ? `Dipendente: ${nomeDipendente}`
                    : "Seleziona dipendente"
                }
                disabled={loadingDip}
              />
            }
          >
            {dipendente
              ? dipendente.descrizione || dipendente.codice
              : loadingDip
                ? "Caricamento..."
                : "Seleziona dipendente"}
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput
              showTrigger={false}
              placeholder="Cerca dipendente..."
            />
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

        <SelettorePeriodo
          mese={mese}
          anno={anno}
          onCambia={(m, a) => {
            setMese(m)
            setAnno(a)
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        {dipendente && righe.length > 0 && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {nomeDipendente}
            </span>
            <span className="tabular-nums">
              {" · "}
              {meseLabel}
            </span>
          </p>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !dipendente ? (
          <Empty className="rounded-lg border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserIcon />
              </EmptyMedia>
              <EmptyTitle>Nessun dipendente selezionato</EmptyTitle>
              <EmptyDescription>
                Seleziona un dipendente per confrontare timbrature e
                rapportini del periodo.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="hidden md:block">
              <Table containerClassName="max-h-[70vh] overflow-auto rounded-lg border">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      rowSpan={2}
                      className={cn(THEAD_STICKY, "top-0 w-24 tabular-nums")}
                    >
                      Data
                    </TableHead>
                    <TableHead
                      colSpan={4}
                      className={cn(
                        THEAD_STICKY,
                        "top-0 text-center text-xs font-semibold text-muted-foreground"
                      )}
                    >
                      Marcatempo (reale)
                    </TableHead>
                    <TableHead
                      colSpan={3}
                      className={cn(
                        THEAD_STICKY,
                        "top-0 text-center text-xs font-semibold text-muted-foreground"
                      )}
                    >
                      Rapportino
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className={cn(THEAD_STICKY, "top-0 w-24 text-right tabular-nums")}
                    >
                      Ordinario
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className={cn(THEAD_STICKY, "top-0 w-28 text-right tabular-nums")}
                    >
                      Straord. lavoro
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className={cn(THEAD_STICKY, "top-0 w-28 text-right tabular-nums")}
                    >
                      Straord. viaggio
                    </TableHead>
                    <TableHead
                      colSpan={4}
                      className={cn(
                        THEAD_STICKY,
                        "top-0 text-center text-xs font-semibold text-muted-foreground"
                      )}
                    >
                      Orario ricostruito
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className={cn(THEAD_STICKY, "top-0 w-10 text-center")}
                    >
                      <span className="sr-only">Dettaglio</span>
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    {["Entrata", "Uscita", "Entrata", "Uscita"].map((l, i) => (
                      <TableHead
                        key={`grezzo-${i}`}
                        className={cn(THEAD_STICKY, "top-10 text-center font-normal", COL_ORA)}
                      >
                        {l}
                      </TableHead>
                    ))}
                    <TableHead
                      className={cn(THEAD_STICKY, "top-10 text-center font-normal", COL_ORA)}
                    >
                      Lavoro
                    </TableHead>
                    <TableHead
                      className={cn(THEAD_STICKY, "top-10 text-center font-normal", COL_ORA)}
                    >
                      Viaggio
                    </TableHead>
                    <TableHead
                      className={cn(THEAD_STICKY, "top-10 w-14 text-center font-normal")}
                    >
                      Pernotto
                    </TableHead>
                    {["Entrata", "Uscita", "Entrata", "Uscita"].map((l, i) => (
                      <TableHead
                        key={`ricostruito-${i}`}
                        className={cn(THEAD_STICKY, "top-10 text-center font-normal", COL_ORA)}
                      >
                        {l}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {righe.map((r) => (
                    <TableRow key={r.giorno} className={cn(r.we && "bg-muted/40")}>
                      <TableCell className="tabular-nums">
                        {format(r.data, "dd", { locale: it })}{" "}
                        <span className="text-muted-foreground">
                          {nomeGiorno(r.data, "EEE")}
                        </span>
                      </TableCell>
                      <TableCell className={COL_ORA}>
                        {r.grezzo.entrata1?.slice(0, 5) ?? "—"}
                      </TableCell>
                      <TableCell className={COL_ORA}>
                        {r.grezzo.uscita1?.slice(0, 5) ?? "—"}
                      </TableCell>
                      <TableCell className={COL_ORA}>
                        {r.grezzo.entrata2?.slice(0, 5) ?? "—"}
                      </TableCell>
                      <TableCell className={COL_ORA}>
                        {r.grezzo.uscita2?.slice(0, 5) ?? "—"}
                      </TableCell>
                      <TableCell className={COL_ORA}>
                        {formattaMinuti(r.lavoroMinuti)}
                      </TableCell>
                      <TableCell className={COL_ORA}>
                        {formattaMinuti(r.viaggioMinuti)}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.pernottamento ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <MoonIcon
                                className="mx-auto size-4 text-muted-foreground"
                                aria-label="Pernotto"
                              />
                            </TooltipTrigger>
                            <TooltipContent>Pernotto</TooltipContent>
                          </Tooltip>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formattaMinuti(r.ordinario)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          r.straordinarioLavoro > 0 && "text-straordinario"
                        )}
                      >
                        {formattaMinuti(r.straordinarioLavoro)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          r.straordinarioViaggio > 0 && "text-straordinario"
                        )}
                      >
                        {formattaMinuti(r.straordinarioViaggio)}
                      </TableCell>
                      {(
                        [
                          r.ricostruito.entrata1,
                          r.ricostruito.uscita1,
                          r.ricostruito.entrata2,
                          r.ricostruito.uscita2,
                        ] as const
                      ).map((v, i) => (
                        <TableCell
                          key={i}
                          className={cn(
                            COL_ORA,
                            v && "text-muted-foreground italic"
                          )}
                        >
                          {v?.slice(0, 5) ?? "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        {r.righeRapportino.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Dettaglio rapportini del ${format(r.data, "dd/MM", { locale: it })}`}
                                onClick={() => setDettaglioGiorno(r.giorno)}
                              >
                                <InfoIcon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {r.righeRapportino.length === 1
                                ? "1 rapportino"
                                : `${r.righeRapportino.length} rapportini`}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {righe.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={8} className={cn(TFOOT_STICKY, "text-right")}>
                        Totale mese
                      </TableCell>
                      <TableCell className={cn(TFOOT_STICKY, "text-right tabular-nums")}>
                        {formattaMinuti(
                          righe.reduce((s, r) => s + r.ordinario, 0)
                        )}
                      </TableCell>
                      <TableCell className={cn(TFOOT_STICKY, "text-right tabular-nums text-straordinario")}>
                        {formattaMinuti(
                          righe.reduce((s, r) => s + r.straordinarioLavoro, 0)
                        )}
                      </TableCell>
                      <TableCell className={cn(TFOOT_STICKY, "text-right tabular-nums text-straordinario")}>
                        {formattaMinuti(
                          righe.reduce((s, r) => s + r.straordinarioViaggio, 0)
                        )}
                      </TableCell>
                      <TableCell colSpan={5} className={TFOOT_STICKY} />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                L&rsquo;orario ricostruito (in corsivo) è dedotto dal totale
                del rapportino a partire dall&rsquo;orario standard: non è un
                dato timbrato. Pagina di sola lettura, nessuna correzione
                viene salvata.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {righe.map((r) => (
                <Card key={r.giorno} size="sm" className={cn(r.we && "bg-muted/40")}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="tabular-nums">
                          {format(r.data, "dd/MM", { locale: it })}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                          {nomeGiorno(r.data, "EEEE")}
                        </span>
                        {r.pernottamento && (
                          <MoonIcon
                            className="size-4 text-muted-foreground"
                            aria-label="Pernotto"
                          />
                        )}
                      </div>
                      {r.righeRapportino.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Dettaglio rapportini del ${format(r.data, "dd/MM", { locale: it })}`}
                              onClick={() => setDettaglioGiorno(r.giorno)}
                            >
                              <InfoIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {r.righeRapportino.length === 1
                              ? "1 rapportino"
                              : `${r.righeRapportino.length} rapportini`}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Marcatempo: {r.grezzo.entrata1?.slice(0, 5) ?? "—"}–
                        {r.grezzo.uscita1?.slice(0, 5) ?? "—"} /{" "}
                        {r.grezzo.entrata2?.slice(0, 5) ?? "—"}–
                        {r.grezzo.uscita2?.slice(0, 5) ?? "—"}
                      </span>
                      <span>
                        Rapportino: lavoro {formattaMinuti(r.lavoroMinuti)} ·
                        viaggio {formattaMinuti(r.viaggioMinuti)}
                      </span>
                      <span className="italic">
                        Ricostruito:{" "}
                        {r.ricostruito.entrata1?.slice(0, 5) ?? "—"}–
                        {r.ricostruito.uscita1?.slice(0, 5) ?? "—"} /{" "}
                        {r.ricostruito.entrata2?.slice(0, 5) ?? "—"}–
                        {r.ricostruito.uscita2?.slice(0, 5) ?? "—"}
                      </span>
                      <span className="flex items-center gap-2 tabular-nums">
                        <span>{formattaMinuti(r.ordinario)}</span>
                        {(r.straordinarioLavoro > 0 ||
                          r.straordinarioViaggio > 0) && (
                          <span className="text-straordinario">
                            +{formattaMinuti(
                              r.straordinarioLavoro + r.straordinarioViaggio
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {righe.length > 0 && (
                <Card size="sm">
                  <CardContent className="flex items-center justify-between p-4 text-sm">
                    <span className="font-medium">Totale mese</span>
                    <div className="flex items-center gap-2 text-xs tabular-nums">
                      <span>
                        {formattaMinuti(
                          righe.reduce((s, r) => s + r.ordinario, 0)
                        )}
                      </span>
                      <span className="text-straordinario">
                        +
                        {formattaMinuti(
                          righe.reduce(
                            (s, r) =>
                              s + r.straordinarioLavoro + r.straordinarioViaggio,
                            0
                          )
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      <Sheet
        open={dettaglioGiorno !== null}
        onOpenChange={(open) => !open && setDettaglioGiorno(null)}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {rigaDettaglio &&
                `Rapportini del ${format(rigaDettaglio.data, "dd MMMM yyyy", { locale: it })}`}
            </SheetTitle>
            <SheetDescription>
              {rigaDettaglio?.righeRapportino.length === 1
                ? "1 riga da cmd"
                : `${rigaDettaglio?.righeRapportino.length ?? 0} righe da cmd`}
              {" · "}sommate nella tabella
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
            {rigaDettaglio?.righeRapportino.map((riga) => (
              <RapportinoRigaCard key={riga.progressivo} riga={riga} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
