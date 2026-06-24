import { z } from "zod"

import { ok, parseJson, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { createNote, listNotes } from "@/lib/notes"

const createNoteSchema = z.object({
  text: z.string().trim().min(1, "Il campo 'text' è obbligatorio"),
})

// GET /api/notes — elenco delle note dell'utente autenticato
export const GET = safeHandler(async () => {
  const session = await getSession()
  if (!session) throw unauthorized()

  const notes = await listNotes(session.user.id)
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
