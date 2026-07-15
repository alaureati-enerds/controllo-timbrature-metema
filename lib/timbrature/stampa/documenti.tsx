import { Document, type DocumentProps } from "@react-pdf/renderer"
import { cloneElement, type ReactElement } from "react"

import type { StampaTemplateId } from "@/lib/timbrature/stampa/catalog"
import type { DatiStampa } from "@/lib/timbrature/stampa/dati"
import { PaginaRegistroClassico } from "@/lib/timbrature/stampa/registro-classico"

// Una PAGINA stampabile: dati di un dipendente → <Page> di @react-pdf/renderer.
// Il wrapper <Document> vive qui (non nei template), così la stessa pagina si
// compone sia in un documento singolo sia in uno cumulativo (più dipendenti).
export type PaginaStampa = (dati: DatiStampa) => ReactElement

// Mappa `id del template → pagina PDF`. È la metà SERVER-ONLY del catalogo
// (lib/timbrature/stampa/catalog.ts): qui si importa @react-pdf/renderer, che
// non deve mai finire nel bundle del client. La usa solo la route di stampa
// (app/api/admin/timbrature/stampa/route.ts).
//
// AGGIUNGERE UN TEMPLATE: una voce nel catalogo + una riga qui.

const pagine: Record<StampaTemplateId, PaginaStampa> = {
  "registro-classico": (dati) => <PaginaRegistroClassico dati={dati} />,
}

const MESI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
]

/** Documento con la stampa di un singolo dipendente. */
export function renderDocumento(
  templateId: StampaTemplateId,
  dati: DatiStampa
): ReactElement<DocumentProps> {
  return (
    <Document
      title={`Registro presenze — ${dati.dipendente.descrizione || dati.dipendente.codice}`}
      author="Registro Presenze"
    >
      {pagine[templateId](dati)}
    </Document>
  )
}

/**
 * Documento cumulativo: una pagina per dipendente, nell'ordine ricevuto (già
 * alfabetico). `cloneElement` inietta la `key` sulla `<Page>` di ciascuno — un
 * array di `<Page>` è il modo standard di comporre un `<Document>` multipagina.
 */
export function renderDocumentoCumulativo(
  templateId: StampaTemplateId,
  mese: number,
  anno: number,
  datiList: DatiStampa[]
): ReactElement<DocumentProps> {
  return (
    <Document
      title={`Registro presenze — ${MESI[mese - 1]} ${anno}`}
      author="Registro Presenze"
    >
      {datiList.map((dati) =>
        cloneElement(pagine[templateId](dati), { key: dati.dipendente.codice })
      )}
    </Document>
  )
}
