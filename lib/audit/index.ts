import type { AuditLog, Prisma } from "@/lib/generated/prisma/client"
import { actionLabel, categoryOf } from "@/lib/audit/catalog"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { getAuditSettings } from "@/lib/settings/audit"

// Superficie pubblica dell'audit log. Tutto il resto dell'app SCRIVE con
// `audit()` e LEGGE con `listAuditLogs()`; nessuno tocca la tabella audit_log
// direttamente (è append-only). La cancellazione esiste solo come pruning di
// retention (`pruneAuditLogs`, chiamata dal worker). Vedi docs/audit-logging.md.

export type AuditOutcome = "success" | "failure"

// Su COSA si è agito. Forma libera per evento; `label` è denormalizzato così la
// riga resta leggibile anche se il target viene poi eliminato.
export type AuditTarget = { type: string; id?: string; label?: string }

export type AuditInput = {
  // Chiave dell'evento (vedi lib/audit/catalog.ts). La categoria si deriva da qui.
  action: string
  // Esito; default "success".
  outcome?: AuditOutcome
  // Chi ha agito. null/assente = anonimo (es. login fallito) o azione di sistema.
  actorId?: string | null
  // Email dell'attore, denormalizzata (vedi sopra). Se assente e c'è `actorId`,
  // la si può lasciare vuota: il viewer mostra comunque l'id.
  actorEmail?: string | null
  target?: AuditTarget | null
  // Contesto extra. REGOLA D'ORO: mai segreti (password, token, secret 2FA).
  metadata?: Record<string, unknown> | null
  // Richiesta da cui ricavare IP / user-agent / request-id. In un route handler
  // passa `request`; in un hook di Better Auth passa `ctx.request`.
  request?: { headers: Headers } | null
  // Override espliciti (se non si ha la richiesta a portata di mano).
  ip?: string | null
  userAgent?: string | null
  requestId?: string | null
}

// --- Dedup anti-flood per eventi ANONIMI ------------------------------------
// Login falliti e tentativi di intrusione possono arrivare a raffica: senza un
// freno, un attaccante riempirebbe la tabella. Collassiamo gli eventi identici
// (stessa action + stesso IP) entro una finestra breve in un'unica riga.
// È una mappa IN MEMORIA: sufficiente per un'istanza singola; con più istanze
// dietro un bilanciatore servirebbe un dedup condiviso (es. su Redis/DB).
const DEDUP_WINDOW_MS = 60_000
const dedup = new Map<string, number>()

function shouldDropDuplicate(action: string, ip: string | null): boolean {
  if (!ip) return false
  const key = `${action}|${ip}`
  const now = Date.now()
  const last = dedup.get(key)
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return true
  dedup.set(key, now)
  // Pulizia opportunistica per non far crescere la mappa all'infinito.
  if (dedup.size > 5_000) {
    for (const [k, t] of dedup) if (now - t >= DEDUP_WINDOW_MS) dedup.delete(k)
  }
  return false
}

function clientInfo(req?: { headers: Headers } | null) {
  const h = req?.headers
  if (!h) return { ip: null, userAgent: null, requestId: null }
  const xff = h.get("x-forwarded-for")
  const ip = (xff ? xff.split(",")[0]?.trim() : h.get("x-real-ip")) || null
  return {
    ip,
    userAgent: h.get("user-agent") || null,
    requestId: h.get("x-request-id") || null,
  }
}

/**
 * Registra un evento di audit. FAIL-OPEN: un errore di scrittura viene loggato
 * ma NON propagato, così il logging non può mai far fallire l'operazione di
 * business (un login non deve rompersi perché il log non è scrivibile).
 *
 * Rispetta la configurazione admin (logging on/off, eventi disabilitati) e il
 * dedup degli eventi anonimi. Vedi lib/settings/audit.ts.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    const settings = await getAuditSettings()
    if (!settings.enabled) return
    if (settings.disabledActions.includes(input.action)) return

    const info = clientInfo(input.request)
    const ip = input.ip ?? info.ip
    const actorId = input.actorId ?? null

    // Solo gli eventi senza attore passano dal freno anti-flood.
    if (!actorId && shouldDropDuplicate(input.action, ip)) return

    await prisma.auditLog.create({
      data: {
        action: input.action,
        category: categoryOf(input.action),
        outcome: input.outcome ?? "success",
        actorId,
        actorEmail: input.actorEmail ?? null,
        target: (input.target ?? undefined) as Prisma.InputJsonValue | undefined,
        metadata: (input.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        ip,
        userAgent: input.userAgent ?? info.userAgent,
        requestId: input.requestId ?? info.requestId,
      },
    })
  } catch (error) {
    logger.error("Audit log non scritto", error)
  }
}

// --- Lettura (pannello admin) -----------------------------------------------

export type AuditLogView = {
  id: string
  action: string
  actionLabel: string
  category: string
  outcome: AuditOutcome
  actorId: string | null
  actorEmail: string | null
  target: AuditTarget | null
  metadata: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export type AuditFilters = {
  category?: string
  action?: string
  outcome?: AuditOutcome
  // Ricerca testuale su attore (email o id).
  actor?: string
  from?: string // ISO date/datetime (incluso)
  to?: string // ISO date/datetime (incluso)
  limit?: number
  offset?: number
}

function toView(row: AuditLog): AuditLogView {
  return {
    id: row.id,
    action: row.action,
    actionLabel: actionLabel(row.action),
    category: row.category,
    outcome: row.outcome as AuditOutcome,
    actorId: row.actorId,
    actorEmail: row.actorEmail,
    target: (row.target as AuditTarget | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Elenco paginato del registro, dal più recente. L'autorizzazione (solo admin)
 * sta a monte nel route handler (requireAuditPermission), non qui.
 */
export async function listAuditLogs(
  filters: AuditFilters = {}
): Promise<{ entries: AuditLogView[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const offset = Math.max(filters.offset ?? 0, 0)

  const where: Prisma.AuditLogWhereInput = {}
  if (filters.category) where.category = filters.category
  if (filters.action) where.action = filters.action
  if (filters.outcome) where.outcome = filters.outcome
  if (filters.actor) {
    where.OR = [
      { actorEmail: { contains: filters.actor, mode: "insensitive" } },
      { actorId: filters.actor },
    ]
  }
  if (filters.from || filters.to) {
    where.createdAt = {}
    if (filters.from) where.createdAt.gte = new Date(filters.from)
    if (filters.to) where.createdAt.lte = new Date(filters.to)
  }

  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ])

  return { entries: rows.map(toView), total }
}

/**
 * Pruning di retention: cancella le righe più vecchie di `retentionDays`.
 * È l'UNICO punto che cancella audit log, ed è un'operazione di SISTEMA
 * (worker), non un'azione applicativa. `retentionDays <= 0` = conserva tutto
 * (no-op). Ritorna il numero di righe eliminate.
 */
export async function pruneAuditLogs(retentionDays: number): Promise<number> {
  if (retentionDays <= 0) return 0
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return count
}
