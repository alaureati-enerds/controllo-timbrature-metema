import type { DocumentProps } from "@react-pdf/renderer"
import type { ReactElement } from "react"

import type { StampaTemplateId } from "@/lib/timbrature/stampa/catalog"
import type { DatiStampa } from "@/lib/timbrature/stampa/dati"
import { RegistroClassico } from "@/lib/timbrature/stampa/registro-classico"

// Un documento stampabile: dati → <Document> di @react-pdf/renderer.
export type DocumentoStampa = (dati: DatiStampa) => ReactElement<DocumentProps>

// Mappa `id del template → documento PDF`. È la metà SERVER-ONLY del catalogo
// (lib/timbrature/stampa/catalog.ts): qui si importa @react-pdf/renderer, che
// non deve mai finire nel bundle del client. La usa solo la route di stampa
// (app/api/admin/timbrature/stampa/route.ts).
//
// AGGIUNGERE UN TEMPLATE: una voce nel catalogo + una riga qui.

const documenti: Record<StampaTemplateId, DocumentoStampa> = {
  "registro-classico": (dati) => <RegistroClassico dati={dati} />,
}

export function renderDocumento(
  templateId: StampaTemplateId,
  dati: DatiStampa
): ReactElement<DocumentProps> {
  return documenti[templateId](dati)
}
