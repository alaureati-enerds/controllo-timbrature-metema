"use client"

import { useState } from "react"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
]

// Selettore del periodo (mese 0-based + anno): le frecce per il mese vicino,
// il popover per il salto lontano (l'anno si sfoglia senza cambiare il mese
// finché non se ne sceglie uno). Condiviso tra le pagine Timbrature e
// Rapportini.
export function SelettorePeriodo({
  mese,
  anno,
  onCambia,
}: {
  mese: number
  anno: number
  onCambia: (mese: number, anno: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [annoVista, setAnnoVista] = useState(anno)

  function apri(aperto: boolean) {
    if (aperto) setAnnoVista(anno)
    setOpen(aperto)
  }

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Mese precedente"
            onClick={() =>
              mese === 0 ? onCambia(11, anno - 1) : onCambia(mese - 1, anno)
            }
          >
            <ChevronLeftIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Mese precedente</TooltipContent>
      </Tooltip>

      <Popover open={open} onOpenChange={apri}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="min-w-0 flex-1 justify-start font-normal tabular-nums sm:w-40 sm:flex-none"
              >
                <CalendarIcon data-icon="inline-start" />
                {MESI[mese]} {anno}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Scegli mese e anno</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-64">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Anno precedente"
              onClick={() => setAnnoVista((a) => a - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="text-sm font-medium tabular-nums">
              {annoVista}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Anno successivo"
              onClick={() => setAnnoVista((a) => a + 1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MESI.map((nome, i) => (
              <Button
                key={nome}
                variant={i === mese && annoVista === anno ? "default" : "ghost"}
                size="sm"
                className="justify-center font-normal"
                aria-label={`${nome} ${annoVista}`}
                onClick={() => {
                  onCambia(i, annoVista)
                  setOpen(false)
                }}
              >
                {nome.slice(0, 3)}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Mese successivo"
            onClick={() =>
              mese === 11 ? onCambia(0, anno + 1) : onCambia(mese + 1, anno)
            }
          >
            <ChevronRightIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Mese successivo</TooltipContent>
      </Tooltip>
    </div>
  )
}
