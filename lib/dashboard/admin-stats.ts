import "server-only"

import { prisma } from "@/lib/prisma"
import { listAuditLogs, type AuditLogView } from "@/lib/audit"
import type { JobStatus } from "@/lib/generated/prisma/client"

// Aggregazione dati per la dashboard admin. Tiene in un solo posto tutte le
// query di overview (conteggi + serie temporali), così la pagina resta un
// semplice consumatore. È TUTTO server-side: protetto a monte da requireRole.
//
// Le serie temporali (registrazioni, eventi di audit) sono raggruppate per
// giorno in JS dopo aver letto le sole colonne necessarie nella finestra: per i
// volumi di uno scaffold è la via più semplice e portabile (niente SQL grezzo).

const DAY_MS = 24 * 60 * 60 * 1000

export type DailyPoint = {
  /** Giorno in formato ISO (yyyy-MM-dd), usato come chiave dell'asse X. */
  date: string
  registrations: number
  auditOk: number
  auditFail: number
}

export type AdminStats = {
  users: {
    total: number
    verified: number
    twoFactor: number
    banned: number
    newLast7: number
  }
  notes: { total: number; newLast7: number }
  files: { total: number; totalSize: number }
  jobs: {
    active: number
    failedLast7: number
    byStatus: Record<JobStatus, number>
  }
  notifications: { unread: number }
  /** Serie giornaliera degli ultimi `days` giorni (incluso oggi). */
  daily: DailyPoint[]
  /** Ultimi eventi del registro di audit, già pronti per la tabella. */
  recentAudit: AuditLogView[]
}

/** Chiave giorno (yyyy-MM-dd) in ora locale del server. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

export async function getAdminStats(days = 14): Promise<AdminStats> {
  const now = Date.now()
  const last7 = new Date(now - 7 * DAY_MS)
  // Inizio della finestra: l'alba di `days-1` giorni fa (incluso oggi).
  const windowStart = new Date(now - (days - 1) * DAY_MS)
  windowStart.setHours(0, 0, 0, 0)

  const [
    usersTotal,
    usersVerified,
    usersTwoFactor,
    usersBanned,
    usersNew7,
    notesTotal,
    notesNew7,
    filesAgg,
    jobsActive,
    jobsFailed7,
    jobsGrouped,
    unread,
    recentRegistrations,
    recentAuditRows,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { twoFactorEnabled: true } }),
    prisma.user.count({ where: { banned: true } }),
    prisma.user.count({ where: { createdAt: { gte: last7 } } }),
    prisma.note.count(),
    prisma.note.count({ where: { createdAt: { gte: last7 } } }),
    prisma.file.aggregate({ _count: true, _sum: { size: true } }),
    prisma.job.count({ where: { status: { in: ["queued", "running"] } } }),
    prisma.job.count({
      where: { status: "failed", createdAt: { gte: last7 } },
    }),
    prisma.job.groupBy({
      by: ["status"],
      _count: { status: true },
      orderBy: { status: "asc" },
    }),
    prisma.notification.count({ where: { readAt: null } }),
    prisma.user.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true, outcome: true },
    }),
  ])

  // Riusa il service di audit per le righe già "viewizzate" (label, ecc.). Non
  // è una PrismaPromise, quindi resta fuori dalla $transaction.
  const recentAuditList = await listAuditLogs({ limit: 8 })

  // Bucket vuoti per ogni giorno della finestra, in ordine cronologico.
  const buckets = new Map<string, DailyPoint>()
  for (let i = 0; i < days; i++) {
    const d = new Date(windowStart.getTime() + i * DAY_MS)
    buckets.set(dayKey(d), {
      date: dayKey(d),
      registrations: 0,
      auditOk: 0,
      auditFail: 0,
    })
  }
  for (const u of recentRegistrations) {
    const b = buckets.get(dayKey(u.createdAt))
    if (b) b.registrations++
  }
  for (const a of recentAuditRows) {
    const b = buckets.get(dayKey(a.createdAt))
    if (!b) continue
    if (a.outcome === "failure") b.auditFail++
    else b.auditOk++
  }

  const byStatus = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  } as Record<JobStatus, number>
  for (const g of jobsGrouped) {
    const c = g._count
    byStatus[g.status] = typeof c === "object" && c ? (c.status ?? 0) : 0
  }

  return {
    users: {
      total: usersTotal,
      verified: usersVerified,
      twoFactor: usersTwoFactor,
      banned: usersBanned,
      newLast7: usersNew7,
    },
    notes: { total: notesTotal, newLast7: notesNew7 },
    files: { total: filesAgg._count, totalSize: filesAgg._sum.size ?? 0 },
    jobs: { active: jobsActive, failedLast7: jobsFailed7, byStatus },
    notifications: { unread },
    daily: Array.from(buckets.values()),
    recentAudit: recentAuditList.entries,
  }
}
