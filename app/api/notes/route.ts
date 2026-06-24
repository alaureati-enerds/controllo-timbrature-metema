import { createNote, listNotes } from "@/lib/notes"

// GET /api/notes — elenco delle note
export async function GET() {
  const notes = await listNotes()
  return Response.json(notes)
}

// POST /api/notes — crea una nota a partire da { text }
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Corpo JSON non valido" }, { status: 400 })
  }

  const text =
    typeof body === "object" && body !== null && "text" in body
      ? String((body as { text: unknown }).text ?? "").trim()
      : ""

  if (!text) {
    return Response.json({ error: "Il campo 'text' è obbligatorio" }, { status: 400 })
  }

  const note = await createNote(text)
  return Response.json(note, { status: 201 })
}
