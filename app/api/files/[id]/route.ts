import { Readable } from "node:stream"

import { fail, ok, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import {
  canRead,
  deleteUserFile,
  findFile,
  getFileStream,
} from "@/lib/files"

type Context = { params: Promise<{ id: string }> }

// GET /api/files/:id — serve i byte del file applicando l'autorizzazione: i
// file di sistema sono pubblici, quelli utente solo per il proprietario. In caso
// di mancato accesso rispondiamo 404 (non 403) per non rivelarne l'esistenza.
export const GET = safeHandler(async (_request, context) => {
  const { id } = await (context as Context).params
  const file = await findFile(id)
  if (!file) return fail("File non trovato", 404)

  const session = await getSession()
  if (!canRead(file, session?.user.id)) return fail("File non trovato", 404)

  const stream = await getFileStream(file)
  // Header di sicurezza: neutralizzano eventuali script in un SVG aperto
  // direttamente come documento, e impediscono il MIME sniffing.
  const headers = new Headers({
    "Content-Type": file.mimeType,
    "Content-Length": String(file.size),
    "Content-Disposition": file.originalName
      ? `inline; filename="${encodeURIComponent(file.originalName)}"`
      : "inline",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    // L'URL è per-id e il contenuto è immutabile: un nuovo file = nuovo id.
    // I file di sistema sono cacheabili pubblicamente; quelli utente no.
    "Cache-Control":
      file.ownerType === "system"
        ? "public, max-age=31536000, immutable"
        : "private, no-cache",
  })

  return new Response(Readable.toWeb(stream) as ReadableStream, { headers })
})

// DELETE /api/files/:id — elimina un file dell'utente (ownership). 404 se non
// esiste o non gli appartiene.
export const DELETE = safeHandler(async (_request, context) => {
  const { id } = await (context as Context).params
  const session = await getSession()
  if (!session) throw unauthorized()

  const deleted = await deleteUserFile(session.user.id, id)
  if (!deleted) return fail("File non trovato", 404)

  return ok({ id })
})
