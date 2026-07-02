import { randomUUID } from "node:crypto"
import type { Readable } from "node:stream"

import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"

// Logica di dominio per i file caricati. Tiene insieme i due lati di un file:
// i metadati (Postgres, modello File) e i byte (lib/storage/). L'autorizzazione
// è esplicitata qui ma applicata dalle route (app/api/files/).
//
// Due assi di proprietà (vedi schema.prisma):
//  - "system": file globali. Scrittura solo admin, lettura per tutti.
//  - "user":   file dell'utente. Lettura/scrittura solo del proprietario.

export type OwnerType = "system" | "user"

// Metadati esposti alla UI (mai lo storageKey, dettaglio interno dello storage).
export type FileMeta = {
  id: string
  mimeType: string
  size: number
  originalName: string | null
  createdAt: Date
  ownerType: OwnerType
  ownerId: string | null
}

// Riga completa, a uso interno (route di serving): include lo storageKey.
type FileRecord = FileMeta & { storageKey: string }

export type NewFile = {
  buffer: Buffer
  mimeType: string
  originalName?: string | null
}

function toMeta(f: FileRecord): FileMeta {
  return {
    id: f.id,
    mimeType: f.mimeType,
    size: f.size,
    originalName: f.originalName,
    createdAt: f.createdAt,
    ownerType: f.ownerType,
    ownerId: f.ownerId,
  }
}

// Crea un file: prima scrive i byte nello storage, poi la riga di metadati. Se
// l'inserimento fallisce, rimuove i byte già scritti per non lasciare orfani.
async function createFile(
  ownerType: OwnerType,
  ownerId: string | null,
  input: NewFile
): Promise<FileMeta> {
  const storageKey = `${ownerType}/${ownerId ?? "system"}/${randomUUID()}`
  await storage.put(storageKey, input.buffer)
  try {
    const file = await prisma.file.create({
      data: {
        storageKey,
        mimeType: input.mimeType,
        size: input.buffer.length,
        originalName: input.originalName ?? null,
        ownerType,
        ownerId,
      },
    })
    return toMeta(file as FileRecord)
  } catch (error) {
    await storage.delete(storageKey).catch(() => {})
    throw error
  }
}

/** Crea un file di SISTEMA (globale). Da usare solo dopo un check RBAC admin. */
export function createSystemFile(input: NewFile): Promise<FileMeta> {
  return createFile("system", null, input)
}

/** Crea un file di proprietà di `userId` (ownership). */
export function createUserFile(
  userId: string,
  input: NewFile
): Promise<FileMeta> {
  return createFile("user", userId, input)
}

/** Riga grezza per id (include lo storageKey): per il serving autorizzato. */
export function findFile(id: string): Promise<FileRecord | null> {
  return prisma.file.findUnique({ where: { id } }) as Promise<FileRecord | null>
}

/**
 * Può `userId` leggere `file`? I file di sistema sono pubblici; quelli utente
 * solo per il proprietario. (La scrittura dei file di sistema è regolata a parte
 * dal permesso RBAC `settings`, non da qui.)
 */
export function canRead(
  file: Pick<FileRecord, "ownerType" | "ownerId">,
  userId: string | null | undefined
): boolean {
  if (file.ownerType === "system") return true
  return Boolean(userId) && file.ownerId === userId
}

/** Stream dei byte del file dallo storage attivo. */
export function getFileStream(
  file: Pick<FileRecord, "storageKey">
): Promise<Readable> {
  return storage.get(file.storageKey)
}

/** Elimina riga + byte. Lo storage non lancia se i byte sono già assenti. */
export async function deleteFile(
  file: Pick<FileRecord, "id" | "storageKey">
): Promise<void> {
  await prisma.file.delete({ where: { id: file.id } })
  await storage.delete(file.storageKey).catch(() => {})
}

/** Elenco dei file dell'utente (più recenti prima). */
export async function listUserFiles(userId: string): Promise<FileMeta[]> {
  const files = await prisma.file.findMany({
    where: { ownerType: "user", ownerId: userId },
    orderBy: { createdAt: "desc" },
  })
  return files.map((f) => toMeta(f as FileRecord))
}

/**
 * Elimina un file dell'utente applicando l'ownership: ritorna false se il file
 * non esiste o non appartiene a `userId` (il chiamante risponde 404).
 */
export async function deleteUserFile(
  userId: string,
  id: string
): Promise<boolean> {
  const file = await findFile(id)
  if (!file || file.ownerType !== "user" || file.ownerId !== userId) {
    return false
  }
  await deleteFile(file)
  return true
}
