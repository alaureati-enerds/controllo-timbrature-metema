import { FileTextIcon, MoonIcon, PartyPopperIcon, UtensilsIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { RapportinoRiga } from "@/lib/mysql/rapportini"

// Card di dettaglio di UNA riga di rapportino (commessa, descrizione, ore,
// badge vitto/festivo/pernotto): usata dalla Sheet di dettaglio sia in
// /admin/rapportini sia in /admin/timbrature, per non duplicare il rendering.
export function RapportinoRigaCard({ riga }: { riga: RapportinoRiga }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <FileTextIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            {riga.cmsCodice || "—"}
          </span>
          <span className="flex items-center gap-1.5">
            {riga.pernottamento && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <MoonIcon
                    className="size-4 text-muted-foreground"
                    aria-label="Pernotto"
                  />
                </TooltipTrigger>
                <TooltipContent>Pernotto</TooltipContent>
              </Tooltip>
            )}
            {riga.vitto && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <UtensilsIcon
                    className="size-4 text-muted-foreground"
                    aria-label="Vitto"
                  />
                </TooltipTrigger>
                <TooltipContent>Vitto</TooltipContent>
              </Tooltip>
            )}
            {riga.giornoFestivo && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PartyPopperIcon
                    className="size-4 text-muted-foreground"
                    aria-label="Giorno festivo"
                  />
                </TooltipTrigger>
                <TooltipContent>Giorno festivo</TooltipContent>
              </Tooltip>
            )}
          </span>
        </div>
        {riga.descrizione && (
          <p className="text-sm text-muted-foreground">{riga.descrizione}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
          <Badge variant="secondary">
            Lavoro {riga.oreLavorazione}h {riga.minutiLavorazione}m
          </Badge>
          <Badge variant="secondary">
            Viaggio {riga.oreViaggio}h {riga.minutiViaggio}m
          </Badge>
          {riga.tipologia && <span>Tipo {riga.tipologia}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
