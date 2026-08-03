"use client"

import { useCallback, useEffect, useState } from "react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { GIUSTIFICATIVO_CODICE_MAX } from "@/lib/timbrature/giustificativo-schema"

type Giustificativo = {
  id: string
  codice: string
  descrizione: string
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  return data?.error ?? "Operazione non riuscita"
}

export function GiustificativiManager() {
  const [giustificativi, setGiustificativi] = useState<Giustificativo[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const carica = useCallback(() => {
    fetch("/api/admin/giustificativi")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data: Giustificativo[]) => setGiustificativi(data))
      .catch(() => toast.error("Impossibile caricare i giustificativi"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    carica()
  }, [carica])

  async function elimina(g: Giustificativo) {
    setBusyId(g.id)
    try {
      const res = await fetch(`/api/admin/giustificativi/${g.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error(await readError(res))
      toast.success(`Giustificativo «${g.codice}» eliminato`)
      carica()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setBusyId(null)
    }
  }

  const rowActions = (g: Giustificativo) => (
    <div className="flex items-center justify-end gap-1">
      <GiustificativoDialog
        giustificativo={g}
        onSaved={carica}
        tooltip="Modifica"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Modifica ${g.codice}`}
        >
          <PencilIcon />
        </Button>
      </GiustificativoDialog>
      <AlertDialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Elimina ${g.codice}`}
                disabled={busyId === g.id}
              >
                {busyId === g.id ? <Spinner /> : <Trash2Icon />}
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Elimina</TooltipContent>
        </Tooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare «{g.codice}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Il giustificativo verrà eliminato dall&apos;anagrafica. Le
              giornate già giustificate con «{g.codice}» non vengono toccate:
              continuano a valere zero ore e a mostrare la sigla, ma senza più
              la descrizione per esteso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => elimina(g)}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Motivi di assenza</CardTitle>
        <CardDescription>
          Una sigla e la sua descrizione. Applicando un giustificativo a una
          giornata, orari e ore vengono azzerati e le anomalie non sono più
          segnalate.
        </CardDescription>
        <CardAction>
          <GiustificativoDialog onSaved={carica}>
            <Button size="sm">
              <PlusIcon data-icon="inline-start" />
              Nuovo giustificativo
            </Button>
          </GiustificativoDialog>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0 sm:px-6 sm:pb-6">
        {loading ? (
          <div className="flex flex-col gap-2 px-6 pb-6 sm:px-0 sm:pb-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Desktop: tabella */}
            <div className="hidden md:block">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Codice</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead className="w-24 text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {giustificativi.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>
                          <Badge variant="secondary" className="font-medium">
                            {g.codice}
                          </Badge>
                        </TableCell>
                        <TableCell>{g.descrizione}</TableCell>
                        <TableCell>{rowActions(g)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile: card list */}
            <div className="flex flex-col gap-3 px-4 pb-4 md:hidden">
              {giustificativi.map((g) => (
                <Card key={g.id} size="sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-medium">
                          {g.codice}
                        </Badge>
                        <span className="text-sm">{g.descrizione}</span>
                      </span>
                      {rowActions(g)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {giustificativi.length === 0 && (
              <p className="px-6 py-4 text-center text-sm text-muted-foreground">
                Nessun giustificativo. Creane uno con{" "}
                <strong>Nuovo giustificativo</strong>.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Dialog di creazione/modifica. Senza `giustificativo` è in modalità creazione.
// Con `tooltip` avvolge il trigger in un Tooltip (per il bottone solo-icona).
function GiustificativoDialog({
  giustificativo,
  onSaved,
  tooltip,
  children,
}: {
  giustificativo?: Giustificativo
  onSaved: () => void
  tooltip?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [codice, setCodice] = useState(giustificativo?.codice ?? "")
  const [descrizione, setDescrizione] = useState(
    giustificativo?.descrizione ?? ""
  )

  // All'apertura ricarica i valori (in modifica) o li azzera (in creazione).
  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setCodice(giustificativo?.codice ?? "")
      setDescrizione(giustificativo?.descrizione ?? "")
    }
  }

  // Validazione client (rete di sicurezza; la fonte di verità è il server).
  function validate(): string | null {
    if (!codice.trim()) return "Il codice è obbligatorio"
    if (!/^[A-Z0-9-]+$/.test(codice.trim()))
      return "Il codice può contenere solo lettere, cifre e trattini"
    if (!descrizione.trim()) return "La descrizione è obbligatoria"
    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errore = validate()
    if (errore) {
      toast.error(errore)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(
        giustificativo
          ? `/api/admin/giustificativi/${giustificativo.id}`
          : "/api/admin/giustificativi",
        {
          method: giustificativo ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codice: codice.trim(),
            descrizione: descrizione.trim(),
          }),
        }
      )
      if (!res.ok) throw new Error(await readError(res))
      toast.success(
        giustificativo ? "Giustificativo aggiornato" : "Giustificativo creato"
      )
      setOpen(false)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setSaving(false)
    }
  }

  const trigger = tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <DialogTrigger asChild>{children}</DialogTrigger>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  ) : (
    <DialogTrigger asChild>{children}</DialogTrigger>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {giustificativo ? "Modifica giustificativo" : "Nuovo giustificativo"}
            </DialogTitle>
            <DialogDescription>
              La sigla compare sulle giornate giustificate; la descrizione nel
              tooltip e nella stampa.
              {giustificativo
                ? " Cambiando la sigla, le giornate che la usano vengono aggiornate."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="giustificativo-codice">Codice</FieldLabel>
              <Input
                id="giustificativo-codice"
                value={codice}
                onChange={(e) => setCodice(e.target.value.toUpperCase())}
                placeholder="Es. F"
                maxLength={GIUSTIFICATIVO_CODICE_MAX}
                autoComplete="off"
                className="w-full sm:w-32"
                disabled={saving}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="giustificativo-descrizione">
                Descrizione
              </FieldLabel>
              <Input
                id="giustificativo-descrizione"
                value={descrizione}
                onChange={(e) => setDescrizione(e.target.value)}
                placeholder="Es. Ferie"
                autoComplete="off"
                disabled={saving}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Annulla
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Spinner aria-hidden="true" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              {giustificativo ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
