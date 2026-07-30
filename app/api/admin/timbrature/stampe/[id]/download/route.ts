import { Readable } from "node:stream"

import { fail, safeHandler } from "@/lib/api"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import {
  findStampaStorico,
  getStampaStoricoStream,
} from "@/lib/timbrature/stampe-storico"

type Context = { params: Promise<{ id: string }> }

// GET /api/admin/timbrature/stampe/:id/download[?inline=1] — serve i byte del
// PDF salvato nello storico. A differenza di /api/files/[id] (pubblica per i
// file di sistema, vedi lib/files.ts:canRead), qui il download richiede
// SEMPRE il permesso `timbrature.read`: questi PDF contengono dati personali
// dei dipendenti. `?inline=1` (bottone "Visualizza") apre il PDF nel visualizzatore
// del browser invece di scaricarlo. Vedi lib/timbrature/stampe-storico.ts.
export const GET = safeHandler(async (request, context) => {
  await requireTimbraturePermission("read")

  const { id } = await (context as Context).params
  const file = await findStampaStorico(id)
  if (!file) return fail("Stampa non trovata", 404)

  const inline = new URL(request.url).searchParams.get("inline") === "1"

  const stream = await getStampaStoricoStream(file)
  const headers = new Headers({
    "Content-Type": file.mimeType,
    "Content-Length": String(file.size),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.originalName)}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-cache",
  })

  return new Response(Readable.toWeb(stream) as ReadableStream, { headers })
})
