import { renderToBuffer } from "@react-pdf/renderer"
import { z } from "zod"

import { ApiError, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import {
  DEFAULT_TEMPLATE_ID,
  stampaTemplateIds,
} from "@/lib/timbrature/stampa/catalog"
import {
  getDatiStampa,
  getDatiStampaCumulativo,
} from "@/lib/timbrature/stampa/dati"
import {
  renderDocumento,
  renderDocumentoCumulativo,
} from "@/lib/timbrature/stampa/documenti"

// GET /api/admin/timbrature/stampa?dipendente=X&mese=6&anno=2026&template=…
// Restituisce il registro presenze come PDF scaricabile: di un singolo
// dipendente oppure, con `cumulativo=1`, di tutti i dipendenti del mese (uno per
// foglio, in ordine alfabetico, esclusi quelli senza timbrature corrette). Il
// contenuto è RICALCOLATO qui (le correzioni sono già persistite mentre si
// modifica la tabella), quindi la stampa rispecchia sempre ciò che si vede a
// schermo. Vedi docs/stampa-timbrature.md.

const paramsSchema = z
  .object({
    // Assente in modalità cumulativa; obbligatorio per la stampa singola.
    dipendente: z.string().min(1).optional(),
    mese: z.coerce.number().int().min(1).max(12),
    anno: z.coerce.number().int().min(2000).max(2100),
    // Assente = si usa il template predefinito delle impostazioni di sistema.
    template: z.enum(stampaTemplateIds).optional(),
    // "1" = stampa cumulativa di tutti i dipendenti del mese.
    cumulativo: z.enum(["1"]).optional(),
  })
  .refine((v) => v.cumulativo === "1" || v.dipendente, {
    message: "Parametro dipendente mancante",
    path: ["dipendente"],
  })

/** Nome file sicuro: solo lettere, cifre e trattini. */
function slug(testo: string): string {
  return (
    testo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "dipendente"
  )
}

export const GET = safeHandler(async (request) => {
  await requireTimbraturePermission("read")

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const { dipendente, mese, anno, template, cumulativo } =
    paramsSchema.parse(params)

  // Il client passa sempre `template` (dal default per-utente o dalla scelta nel
  // dialog); il fallback copre solo una chiamata diretta senza parametro.
  const templateId = template ?? DEFAULT_TEMPLATE_ID
  const periodo = `${anno}-${String(mese).padStart(2, "0")}`
  const session = await getSession()

  if (cumulativo === "1") {
    const datiList = await getDatiStampaCumulativo(mese, anno)
    if (datiList.length === 0) {
      throw new ApiError(
        "Nessun dipendente con timbrature nel mese selezionato",
        404
      )
    }
    const pdf = await renderToBuffer(
      renderDocumentoCumulativo(templateId, mese, anno, datiList)
    )

    await audit({
      action: "timbrature.stampa",
      actorId: session?.user.id,
      actorEmail: session?.user.email,
      target: { type: "dipendenti", label: "Tutti i dipendenti" },
      metadata: { mese, anno, templateId, dipendenti: datiList.length },
      request,
    })

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="registro-presenze-cumulativo-${periodo}.pdf"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "no-store",
      },
    })
  }

  // `dipendente` è garantito dal refine dello schema quando non è cumulativo.
  const dati = await getDatiStampa(dipendente!, mese, anno)
  const pdf = await renderToBuffer(renderDocumento(templateId, dati))

  await audit({
    action: "timbrature.stampa",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    target: {
      type: "dipendente",
      id: dati.dipendente.codice,
      label: dati.dipendente.descrizione,
    },
    metadata: { mese, anno, templateId },
    request,
  })

  const nome = slug(dati.dipendente.descrizione || dati.dipendente.codice)

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="registro-presenze-${nome}-${periodo}.pdf"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
    },
  })
})
