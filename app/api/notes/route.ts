import { z } from "zod"

import { ok, parseJson, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { createNote, listNotes, searchNotes } from "@/lib/notes"

const createNoteSchema = z.object({
  text: z.string().trim().min(1, "Il campo 'text' è obbligatorio"),
})

// GET /api/notes — elenco delle note dell'utente autenticato.
// Parametri opzionali (usati dalla ricerca globale in topbar):
//   ?q=<testo>    filtra le note che contengono il testo
//   ?limit=<n>    limita il numero di risultati (1–50)
// Senza parametri restituisce l'elenco completo (comportamento storico).
export const GET = safeHandler(async (request) => {
  const session = await getSession()
  if (!session) throw unauthorized()

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()
  const limitParam = searchParams.get("limit")
  const limit = limitParam
    ? Math.min(Math.max(Math.trunc(Number(limitParam)) || 0, 1), 50)
    : undefined

  const notes =
    q !== undefined || limit !== undefined
      ? await searchNotes(session.user.id, q ?? "", limit)
      : await listNotes(session.user.id)

  return ok(notes)
})

// POST /api/notes — crea una nota per l'utente autenticato a partire da { text }
export const POST = safeHandler(async (request) => {
  const session = await getSession()
  if (!session) throw unauthorized()

  const { text } = await parseJson(request, createNoteSchema)
  const note = await createNote(session.user.id, text)
  return ok(note, { status: 201 })
})
