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
  updatedAt: Date
}

export function listNotes(userId: string): Promise<Note[]> {
  return prisma.note.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
}

// Ricerca testuale sulle note dell'utente. Con `query` vuota restituisce le più
// recenti (utile per popolare la palette di ricerca prima che si digiti). È la
// funzione che alimenta la fonte "Note" della ricerca globale (vedi
// lib/search/sources.ts) ed è il modello da replicare per nuovi tipi di record.
export function searchNotes(
  userId: string,
  query: string,
  limit?: number
): Promise<Note[]> {
  const q = query.trim()
  return prisma.note.findMany({
    where: {
      userId,
      ...(q ? { text: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: limit } : {}),
  })
}

// Una singola nota dell'utente. Filtra anche per `userId` (ownership): se la
// nota non esiste o è di un altro utente restituisce `null`, così il chiamante
// può rispondere con un 404 senza distinguere i due casi.
export function getNote(userId: string, id: string): Promise<Note | null> {
  return prisma.note.findFirst({
    where: { id, userId },
  })
}

export function createNote(userId: string, text: string): Promise<Note> {
  return prisma.note.create({
    data: { text, userId },
  })
}
