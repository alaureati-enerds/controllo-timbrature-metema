import {
  CarIcon,
  FileTextIcon,
  MoonIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { RapportinoRiga } from "@/lib/mysql/rapportini"

const EURO = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
})

function formattaOreMin(ore: number, minuti: number): string {
  return ore === 0 && minuti === 0 ? "—" : `${ore}h ${minuti}m`
}

// Card di dettaglio di UNA riga di rapportino: usata dalla Sheet di dettaglio
// sia in /admin/rapportini sia in /admin/timbrature, per non duplicare il
// rendering. I campi sotto le ore (trasferta, guida, vitto/alloggio) vengono
// dalla stessa query di lib/mysql/rapportini.ts ma restano nascosti quando
// non c'è nulla da dire (niente righe "0 km" o "0,00 €" a riempire spazio).
export function RapportinoRigaCard({ riga }: { riga: RapportinoRiga }) {
  const haTrasferta = riga.kilometri > 0 || riga.rimborsoChilometrico > 0
  const haGuida = Boolean(riga.guidatoDalle && riga.guidatoAlle)

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 p-4">
        <span className="text-xs font-medium text-muted-foreground">
          Rapportino n. {riga.progressivo}
        </span>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <FileTextIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                {riga.cmsCodice || "—"}
                {riga.tipologia && (
                  <span className="font-normal">
                    {" · "}Sottocommessa {riga.tipologia}
                  </span>
                )}
              </span>
            </span>
            {riga.cmsDescrizione && (
              <span className="text-xs text-muted-foreground">
                {riga.cmsDescrizione}
              </span>
            )}
          </div>
        </div>

        {riga.descrizione && (
          <p className="text-sm text-muted-foreground">{riga.descrizione}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="tabular-nums">
            Lavoro {formattaOreMin(riga.oreLavorazione, riga.minutiLavorazione)}
          </Badge>
          <Badge variant="secondary" className="tabular-nums">
            Viaggio {formattaOreMin(riga.oreViaggio, riga.minutiViaggio)}
          </Badge>
          {riga.pernottamento && (
            <Badge variant="outline" className="gap-1">
              <MoonIcon className="size-3" />
              Pernotto
            </Badge>
          )}
        </div>

        {(haTrasferta || riga.targaAutomezzo || haGuida || riga.importoVitto > 0 || riga.importoAlloggio > 0) && (
          <>
          <Separator />
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-xs">
            {haTrasferta && (
              <>
                <dt className="text-muted-foreground">Trasferta</dt>
                <dd className="tabular-nums">
                  {riga.kilometri > 0 && `${riga.kilometri} km`}
                  {riga.kilometri > 0 && riga.rimborsoChilometrico > 0 && " · "}
                  {riga.rimborsoChilometrico > 0 &&
                    `rimborso ${EURO.format(riga.rimborsoChilometrico)}`}
                </dd>
              </>
            )}
            {riga.targaAutomezzo && (
              <>
                <dt className="text-muted-foreground">Automezzo</dt>
                <dd className="inline-flex items-center gap-1.5 tabular-nums">
                  <CarIcon
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {riga.targaAutomezzo}
                </dd>
              </>
            )}
            {haGuida && (
              <>
                <dt className="text-muted-foreground">Alla guida</dt>
                <dd className="tabular-nums">
                  {riga.guidatoDalle?.slice(0, 5)}–{riga.guidatoAlle?.slice(0, 5)}
                </dd>
              </>
            )}
            {riga.importoVitto > 0 && (
              <>
                <dt className="text-muted-foreground">Vitto</dt>
                <dd className="tabular-nums">{EURO.format(riga.importoVitto)}</dd>
              </>
            )}
            {riga.importoAlloggio > 0 && (
              <>
                <dt className="text-muted-foreground">Alloggio</dt>
                <dd className="tabular-nums">
                  {EURO.format(riga.importoAlloggio)}
                </dd>
              </>
            )}
          </dl>
          </>
        )}
      </CardContent>
    </Card>
  )
}
