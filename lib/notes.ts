import { prisma } from "@/lib/prisma"

// Logica di dominio per le note. La teniamo qui, separata dai route handler e dalla UI,
// così è riusabile da Server Components, Route Handlers o un futuro servizio dedicato.

export type Note = {
  id: string
  text: string
  createdAt: Date
}

export function listNotes(): Promise<Note[]> {
  return prisma.note.findMany({
    orderBy: { createdAt: "desc" },
  })
}

export function createNote(text: string): Promise<Note> {
  return prisma.note.create({
    data: { text },
  })
}
