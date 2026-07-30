import { randomUUID } from "node:crypto"
import type { Readable } from "node:stream"

import type { Prisma, StampaGenerata } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"

// Logica di dominio per lo STORICO delle stampe del registro presenze: uno
// SNAPSHOT del PDF esatto generato in un dato momento (a differenza della
// generazione, sempre ricalcolata al volo, vedi
// app/api/admin/timbrature/stampa/route.ts).
//
// NON riusa lib/files.ts/modello File: quei file "di sistema" sono pubblici
// senza alcun controllo RBAC (vedi lib/files.ts:canRead), inadatto per PDF con
// dati personali dei dipendenti. Qui i byte vivono comunque nello stesso
// storage condiviso (lib/storage/), ma la lettura passa SEMPRE da una route
// dedicata che applica `requireTimbraturePermission` (vedi
// app/api/admin/timbrature/stampe/). Visibile a tutti gli admin con permesso
// timbrature, non solo a chi ha generato la stampa.

export type StampaStoricoMeta = {
  id: string
  originalName: string
  mimeType: string
  size: number
  dipendente: string | null
  dipendenteLabel: string | null
  cumulativo: boolean
  mese: number
  anno: number
  templateId: string
  actorId: string | null
  actorEmail: string | null
  createdAt: Date
}

type StampaStoricoRecord = StampaStoricoMeta & { storageKey: string }

function toMeta(row: StampaGenerata): StampaStoricoMeta {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    dipendente: row.dipendente,
    dipendenteLabel: row.dipendenteLabel,
    cumulativo: row.cumulativo,
    mese: row.mese,
    anno: row.anno,
    templateId: row.templateId,
    actorId: row.actorId,
    actorEmail: row.actorEmail,
    createdAt: row.createdAt,
  }
}

export type NewStampaStorico = {
  buffer: Buffer
  mimeType: string
  originalName: string
  dipendente: string | null
  dipendenteLabel: string | null
  cumulativo: boolean
  mese: number
  anno: number
  templateId: string
  actorId: string | null
  actorEmail: string | null
}

/**
 * Salva lo snapshot di una stampa: prima i byte nello storage, poi la riga di
 * metadati (rollback dei byte se l'insert fallisce). Stesso pattern di
 * `createFile` in lib/files.ts.
 */
export async function saveStampaStorico(
  input: NewStampaStorico
): Promise<StampaStoricoMeta> {
  const storageKey = `stampe/${randomUUID()}`
  await storage.put(storageKey, input.buffer)
  try {
    const row = await prisma.stampaGenerata.create({
      data: {
        storageKey,
        mimeType: input.mimeType,
        size: input.buffer.length,
        originalName: input.originalName,
        dipendente: input.dipendente,
        dipendenteLabel: input.dipendenteLabel,
        cumulativo: input.cumulativo,
        mese: input.mese,
        anno: input.anno,
        templateId: input.templateId,
        actorId: input.actorId,
        actorEmail: input.actorEmail,
      },
    })
    return toMeta(row)
  } catch (error) {
    await storage.delete(storageKey).catch(() => {})
    throw error
  }
}

export type StampaStoricoFilters = {
  // Ricerca testuale sul dipendente (codice o nome), come il filtro "attore"
  // dell'audit log.
  q?: string
  mese?: number
  anno?: number
  cumulativo?: boolean
  limit?: number
  offset?: number
}

/** Elenco paginato, dal più recente. L'autorizzazione sta a monte nella route. */
export async function listStampeStorico(
  filters: StampaStoricoFilters = {}
): Promise<{ entries: StampaStoricoMeta[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const offset = Math.max(filters.offset ?? 0, 0)

  const where: Prisma.StampaGenerataWhereInput = {}
  if (filters.q) {
    where.OR = [
      { dipendente: { contains: filters.q, mode: "insensitive" } },
      { dipendenteLabel: { contains: filters.q, mode: "insensitive" } },
    ]
  }
  if (filters.mese) where.mese = filters.mese
  if (filters.anno) where.anno = filters.anno
  if (filters.cumulativo !== undefined) where.cumulativo = filters.cumulativo

  const [rows, total] = await prisma.$transaction([
    prisma.stampaGenerata.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.stampaGenerata.count({ where }),
  ])

  return { entries: rows.map(toMeta), total }
}

/** Riga grezza per id (include lo storageKey): per il download autorizzato. */
export function findStampaStorico(
  id: string
): Promise<StampaStoricoRecord | null> {
  return prisma.stampaGenerata.findUnique({ where: { id } })
}

/** Righe grezze per un elenco di id (include lo storageKey): per lo ZIP massivo. */
export function findManyStampeStorico(
  ids: string[]
): Promise<StampaStoricoRecord[]> {
  return prisma.stampaGenerata.findMany({ where: { id: { in: ids } } })
}

/** Stream dei byte del PDF salvato dallo storage attivo. */
export function getStampaStoricoStream(
  file: Pick<StampaStoricoRecord, "storageKey">
): Promise<Readable> {
  return storage.get(file.storageKey)
}

/** Elimina un set di righe già note (id + storageKey): riga poi byte. */
async function deleteRows(
  rows: { id: string; storageKey: string }[]
): Promise<number> {
  if (rows.length === 0) return 0
  await prisma.stampaGenerata.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  })
  await Promise.all(rows.map((r) => storage.delete(r.storageKey).catch(() => {})))
  return rows.length
}

/**
 * Elimina UNA stampa dallo storico (azione esplicita dell'admin, non
 * retention). Ritorna false se l'id non esiste.
 */
export async function deleteStampaStorico(id: string): Promise<boolean> {
  const row = await prisma.stampaGenerata.findUnique({
    where: { id },
    select: { id: true, storageKey: true },
  })
  if (!row) return false
  await deleteRows([row])
  return true
}

/**
 * Elimina PIÙ stampe dallo storico (azione massiva). Ignora gli id
 * inesistenti. Ritorna il numero effettivamente eliminato.
 */
export async function deleteStampeStorico(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await prisma.stampaGenerata.findMany({
    where: { id: { in: ids } },
    select: { id: true, storageKey: true },
  })
  return deleteRows(rows)
}

/**
 * Pruning di retention: elimina righe + byte più vecchi di `retentionDays`.
 * `retentionDays <= 0` = conserva tutto (no-op). Ritorna il numero eliminato.
 * Gemello di `pruneAuditLogs` (lib/audit/index.ts).
 */
export async function pruneStampeStorico(
  retentionDays: number
): Promise<number> {
  if (retentionDays <= 0) return 0
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const rows = await prisma.stampaGenerata.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, storageKey: true },
  })
  return deleteRows(rows)
}
