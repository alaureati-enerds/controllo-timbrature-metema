"use client"

import { useState } from "react"
import { PrinterIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import type { Dipendente } from "@/lib/mysql/timbrature"
import {
  stampaTemplates,
  type StampaTemplateId,
} from "@/lib/timbrature/stampa/catalog"

// Dialog di stampa del registro presenze: sceglie il template e genera il PDF
// del dipendente/mese correnti. Il contenuto NON viene inviato al server: le
// correzioni sono già persistite mentre si modifica la tabella, quindi la route
// (/api/admin/timbrature/stampa) ricalcola gli stessi valori mostrati a schermo.

export function TimbratureStampaDialog({
  dipendente,
  mese,
  anno,
  meseLabel,
  templatePredefinito,
  disabled,
  className,
}: {
  dipendente: Dipendente | null
  /** Mese 1-12 (non l'indice 0-11 usato dal manager). */
  mese: number
  anno: number
  meseLabel: string
  templatePredefinito: StampaTemplateId
  disabled?: boolean
  /** Posizionamento del bottone nella toolbar che lo ospita. */
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [template, setTemplate] =
    useState<StampaTemplateId>(templatePredefinito)
  const [cumulativo, setCumulativo] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function stampa() {
    if (!cumulativo && !dipendente) return
    setGenerating(true)
    try {
      // In modalità cumulativa il dipendente non serve: la route stampa tutti i
      // dipendenti del mese (esclusi quelli senza timbrature corrette).
      const params = new URLSearchParams({
        mese: String(mese),
        anno: String(anno),
        template,
        ...(cumulativo
          ? { cumulativo: "1" }
          : { dipendente: dipendente!.codice }),
      })
      // Scarichiamo via fetch (non con un link diretto) per poter mostrare lo
      // spinner e trasformare un errore del server (es. MySQL irraggiungibile)
      // in un toast, invece che in un file rotto.
      const res = await fetch(`/api/admin/timbrature/stampa?${params}`)
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Impossibile generare il PDF")
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "registro-presenze.pdf"
      a.click()
      URL.revokeObjectURL(url)

      toast.success("Registro presenze generato")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Impossibile generare il PDF"
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          className={cn("w-full sm:w-auto", className)}
        >
          <PrinterIcon data-icon="inline-start" />
          Stampa
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stampa registro presenze</DialogTitle>
          <DialogDescription>
            Periodo selezionato:{" "}
            <span className="tabular-nums font-medium text-foreground">
              {meseLabel}
            </span>
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="stampa-template">Modello di stampa</FieldLabel>
            <Select
              value={template}
              onValueChange={(v) => setTemplate(v as StampaTemplateId)}
            >
              <SelectTrigger id="stampa-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stampaTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field orientation="horizontal" className="!items-center">
            <FieldContent>
              <FieldLabel htmlFor="stampa-cumulativo">
                Stampa cumulativa
              </FieldLabel>
              <FieldDescription>
                Include tutti i dipendenti
              </FieldDescription>
            </FieldContent>
            <Switch
              id="stampa-cumulativo"
              checked={cumulativo}
              onCheckedChange={setCumulativo}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={generating}>
              Annulla
            </Button>
          </DialogClose>
          <Button
            onClick={stampa}
            disabled={generating || (!cumulativo && !dipendente)}
          >
            {generating ? (
              <Spinner aria-hidden="true" />
            ) : (
              <PrinterIcon data-icon="inline-start" />
            )}
            Genera PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
