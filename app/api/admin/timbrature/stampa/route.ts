import { renderToBuffer } from "@react-pdf/renderer"
import { z } from "zod"

import { safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import { getStampaSettings } from "@/lib/settings/stampa"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import { stampaTemplateIds } from "@/lib/timbrature/stampa/catalog"
import { getDatiStampa } from "@/lib/timbrature/stampa/dati"
import { renderDocumento } from "@/lib/timbrature/stampa/documenti"

// GET /api/admin/timbrature/stampa?dipendente=X&mese=6&anno=2026&template=…
// Restituisce il registro presenze del dipendente per il mese, come PDF
// scaricabile. Il contenuto è RICALCOLATO qui (le correzioni sono già
// persistite mentre si modifica la tabella), quindi la stampa rispecchia
// sempre ciò che si vede a schermo. Vedi docs/stampa-timbrature.md.

const paramsSchema = z.object({
  dipendente: z.string().min(1),
  mese: z.coerce.number().int().min(1).max(12),
  anno: z.coerce.number().int().min(2000).max(2100),
  // Assente = si usa il template predefinito delle impostazioni di sistema.
  template: z.enum(stampaTemplateIds).optional(),
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
  const { dipendente, mese, anno, template } = paramsSchema.parse(params)

  const templateId = template ?? (await getStampaSettings()).templateId
  const dati = await getDatiStampa(dipendente, mese, anno)
  const pdf = await renderToBuffer(renderDocumento(templateId, dati))

  const session = await getSession()
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
  const periodo = `${anno}-${String(mese).padStart(2, "0")}`

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="registro-presenze-${nome}-${periodo}.pdf"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
    },
  })
})
