import { prisma } from "@/lib/prisma"

// Logica di dominio per le note. La teniamo qui, separata dai route handler e dalla UI,
// così è riusabile da Server Components, Route Handlers o un futuro servizio dedicato.
//
// Le note sono di proprietà di un utente: ogni funzione richiede `userId` e opera
// solo sui dati di quell'utente (ownership / isolamento per-utente).

export type Note = {
  id: string
  text: string
  createdAt: Date
}

export function listNotes(userId: string): Promise<Note[]> {
  return prisma.note.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
}

export function createNote(userId: string, text: string): Promise<Note> {
  return prisma.note.create({
    data: { text, userId },
  })
}
