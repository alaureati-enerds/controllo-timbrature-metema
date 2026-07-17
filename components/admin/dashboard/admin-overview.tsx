import Link from "next/link"
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns"
import { it } from "date-fns/locale"
import {
  CalendarClockIcon,
  ClockIcon,
  HistoryIcon,
  LogInIcon,
  LogOutIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KpiFooter } from "@/components/dashboard/kpi-footer"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { getOrarioSettingsForAdmin } from "@/lib/settings/orario"
import { listPresets } from "@/lib/timbrature/preset"
import {
  getPresenzeIntervallo,
  getUltimeTimbrature,
  listDipendenti,
  type Dipendente,
  type PresenzaGiorno,
} from "@/lib/mysql/timbrature"

import { PresenzeChart } from "./presenze-chart"

const GIORNI_ANDAMENTO = 14
const N_ULTIME_TIMBRATURE = 8

// Home per gli admin: le due zone di lavoro principali (Timbrature, Orari di
// lavoro) in cima, seguite da una seconda riga con segnali dal marcatempo:
// andamento delle presenze e ultimi eventi registrati. Server Component: fa
// il fetch al proprio interno, come PersonalOverview.
export async function AdminOverview() {
  const oggi = format(new Date(), "yyyy-MM-dd")
  const inizioAndamento = format(
    subDays(new Date(), GIORNI_ANDAMENTO - 1),
    "yyyy-MM-dd"
  )

  const [dipendenti, presenzeAndamento, ultimeTimbrature, preset, orario] =
    await Promise.all([
      // Il marcatempo aziendale è un sistema esterno: se non è configurato o
      // non risponde, le card restano senza i dati invece di rompere tutta
      // la Home (stesso principio tollerante usato per i rapportini in stampa).
      listDipendenti().catch(() => null),
      getPresenzeIntervallo(inizioAndamento, oggi).catch(() => null),
      getUltimeTimbrature(N_ULTIME_TIMBRATURE).catch(() => null),
      listPresets().then((p) => p.length),
      getOrarioSettingsForAdmin(),
    ])

  const andamento =
    dipendenti && presenzeAndamento
      ? presenzeGiornaliere(dipendenti, presenzeAndamento, inizioAndamento, oggi)
      : null
  const presentiOggi = andamento?.at(-1)?.presenti ?? null
  const nomiDipendenti = new Map(
    (dipendenti ?? []).map((d) => [d.codice, d.descrizione])
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
        <Card className="lg:col-span-2 lg:row-start-1">
          <CardHeader>
            <div className="flex flex-row items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClockIcon />
              </div>
              <div>
                <CardTitle className="text-base">Timbrature</CardTitle>
                <CardDescription>
                  Consulta e correggi le timbrature dei dipendenti dal
                  marcatempo aziendale.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {dipendenti && (
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-semibold tabular-nums">
                  {presentiOggi ?? "—"}
                </span>
                <span className="text-sm text-muted-foreground">
                  Presenti oggi
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-semibold tabular-nums">
                  {dipendenti.length}
                </span>
                <span className="text-sm text-muted-foreground">
                  Nel marcatempo
                </span>
              </div>
            </CardContent>
          )}
          <CardFooter className="justify-end">
            <Button asChild>
              <Link href="/admin/timbrature">
                <ClockIcon data-icon="inline-start" />
                Apri Timbrature
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-2 lg:row-start-2">
          <CardHeader>
            <div className="flex flex-row items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarClockIcon />
              </div>
              <div>
                <CardTitle className="text-base">Orari di lavoro</CardTitle>
                <CardDescription>
                  Gestisci i preset di orario da applicare in blocco alle
                  correzioni delle timbrature.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-semibold tabular-nums">
                {preset}
              </span>
              <span className="text-sm text-muted-foreground">
                {preset === 1 ? "Preset configurato" : "Preset configurati"}
              </span>
            </div>
            <span className="text-sm tabular-nums text-muted-foreground">
              Standard {orario.primoIngresso}–{orario.primaUscita} ·{" "}
              {orario.secondoIngresso}–{orario.secondaUscita}
            </span>
          </CardContent>
          <CardFooter className="justify-end">
            <Button asChild>
              <Link href="/admin/orari-lavoro">
                <CalendarClockIcon data-icon="inline-start" />
                Apri Orari di lavoro
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Wrapper vuoto: la sua unica funzione è definire l'area di griglia
            (colonna 3, righe 1-2) senza contribuire alla loro altezza, così le
            due card di sinistra restano alla loro altezza naturale. La card è
            posizionata in absolute per riempire esattamente quell'area, senza
            forzare le righe a crescere in base al proprio contenuto: quando
            eccede lo spazio disponibile, scrolla internamente. */}
        <div className="relative lg:col-start-3 lg:row-start-1 lg:row-end-3">
          <Card className="flex flex-col lg:absolute lg:inset-0">
            <CardHeader>
              <div className="flex flex-row items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <HistoryIcon />
                </div>
                <div>
                  <CardTitle className="text-base">
                    Ultime timbrature
                  </CardTitle>
                  <CardDescription>
                    Gli eventi più recenti registrati dal marcatempo
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              {ultimeTimbrature === null || ultimeTimbrature.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <HistoryIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nessuna timbratura</EmptyTitle>
                    <EmptyDescription>
                      {ultimeTimbrature === null
                        ? "Il marcatempo aziendale non è raggiungibile."
                        : "Non ci sono ancora eventi registrati."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ul className="flex flex-col gap-1">
                  {ultimeTimbrature.map((t, i) => (
                    <li key={`${t.codiceDip}-${t.data}-${t.ora}-${i}`}>
                      <div className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm">
                        <div className="flex min-w-0 items-center gap-3">
                          {t.tipologia === "E" ? (
                            <LogInIcon className="size-4 shrink-0 text-green-600 dark:text-green-500" />
                          ) : (
                            <LogOutIcon className="size-4 shrink-0 text-red-600 dark:text-red-500" />
                          )}
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">
                              {nomiDipendenti.get(t.codiceDip) ?? t.codiceDip}
                            </span>
                            <span className="text-muted-foreground">
                              {t.tipologia === "E" ? "Entrata" : "Uscita"}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {format(
                            parseISO(`${t.data}T${t.ora}`),
                            "d MMM HH:mm",
                            { locale: it }
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            <KpiFooter href="/admin/timbrature" label="Apri Timbrature">
              Vai alla pagina Timbrature
            </KpiFooter>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Presenze</CardTitle>
          <CardDescription>
            Dipendenti con almeno una timbratura al giorno, ultimi{" "}
            {GIORNI_ANDAMENTO} giorni
          </CardDescription>
        </CardHeader>
        <CardContent>
          {andamento ? (
            <PresenzeChart data={andamento} />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClockIcon />
                </EmptyMedia>
                <EmptyTitle>Dati non disponibili</EmptyTitle>
                <EmptyDescription>
                  Il marcatempo aziendale non è raggiungibile.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Serie giornaliera (uno per ogni giorno dell'intervallo, incluso lo zero) di
 * dipendenti distinti con un'entrata timbrata quel giorno. Scarta la
 * sentinella 00:00 (marcatempo) e i dipendenti obsoleti, come fa il motore di
 * calcolo delle timbrature.
 */
function presenzeGiornaliere(
  dipendenti: Dipendente[],
  presenze: PresenzaGiorno[],
  dal: string,
  al: string
): { date: string; presenti: number }[] {
  const codiciValidi = new Set(dipendenti.map((d) => d.codice))
  const perGiorno = new Map<string, Set<string>>()
  for (const p of presenze) {
    if (p.tipologia !== "E") continue
    if (p.ora.slice(0, 5) === "00:00") continue
    if (!codiciValidi.has(p.codiceDip)) continue
    const presenti = perGiorno.get(p.data) ?? new Set<string>()
    presenti.add(p.codiceDip)
    perGiorno.set(p.data, presenti)
  }

  return eachDayOfInterval({ start: parseISO(dal), end: parseISO(al) }).map(
    (giorno) => {
      const chiave = format(giorno, "yyyy-MM-dd")
      return { date: chiave, presenti: perGiorno.get(chiave)?.size ?? 0 }
    }
  )
}
