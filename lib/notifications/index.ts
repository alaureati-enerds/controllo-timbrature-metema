import type { Notification, Prisma } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import {
  categoryOf,
  defaultChannelsOf,
  isMandatory,
  type NotificationChannel,
} from "@/lib/notifications/catalog"
import { emailChannel } from "@/lib/notifications/channels/email"
import { inAppChannel } from "@/lib/notifications/channels/in-app"
import type { NotificationChannelSink } from "@/lib/notifications/channels/types"
import { prisma } from "@/lib/prisma"
import { getNotificationSettings } from "@/lib/settings/notifications"
import { getUserPreferences } from "@/lib/settings/user"

// Superficie pubblica delle notifiche. Tutto il resto dell'app CREA con
// `notify()` e LEGGE/aggiorna con list/unreadCount/markRead/markAllRead; la
// cancellazione esiste solo come pruning di retention (`pruneNotifications`,
// chiamata dal worker). Tre concetti separati e indipendenti, così aggiungere un
// canale (push, realtime) non tocca i call site: EVENTO (chi chiama notify) →
// NOTIFICA (record per-utente) → CANALE (come arriva). Vedi docs/notifiche.md.

// Mappa canale → sink. Aggiungere un canale: una voce qui + in
// `notificationChannels` (catalog.ts) + un file in channels/.
const sinks: Record<NotificationChannel, NotificationChannelSink> = {
  "in-app": inAppChannel,
  email: emailChannel,
}

export type NotifyInput = {
  // Tipo del catalogo (lib/notifications/catalog.ts). Decide categoria, canali di
  // default, obbligatorietà.
  type: string
  // Destinatario. Per gli eventi rivolti a più persone (es. tutti gli admin) il
  // chiamante itera e chiama `notify()` una volta per destinatario.
  userId: string
  // Contenuto, fornito dal call site (dove vive il contesto), come per `audit()`.
  title: string
  body: string
  // Link facoltativo a cui porta la notifica.
  url?: string
  // Contesto extra serializzabile salvato sulla riga in-app.
  data?: Record<string, unknown>
  // Override esplicito dei canali. Raro: di norma decidono catalogo + preferenze.
  channels?: NotificationChannel[]
}

/**
 * Decide su QUALI canali recapitare un tipo a un utente. Parte dalla scelta
 * dell'utente (override sparso nelle preferenze) o, se assente, dai
 * `defaultChannels` del catalogo. Per i tipi OBBLIGATORI forza comunque l'in-app
 * (non disattivabile), lasciando l'email facoltativa.
 */
async function resolveChannels(
  userId: string,
  type: string,
  override?: NotificationChannel[]
): Promise<NotificationChannel[]> {
  const chosen =
    override ??
    (await getUserPreferences(userId)).notifications.channels[type] ??
    defaultChannelsOf(type)

  const set = new Set<NotificationChannel>(chosen)
  if (isMandatory(type)) set.add("in-app")
  return [...set]
}

/**
 * Crea e recapita una notifica. FAIL-OPEN: un errore non viene mai propagato, così
 * notificare non può far fallire l'operazione di business (un cambio password non
 * si rompe perché il DB notifiche è momentaneamente non scrivibile).
 *
 * Rispetta la configurazione admin (interruttore generale, tipi disabilitati) e
 * le preferenze dell'utente, con UNA ECCEZIONE: i tipi obbligatori (sicurezza)
 * ignorano sia l'admin sia l'utente per il canale in-app. Vedi
 * lib/settings/notifications.ts e lib/settings/user.ts.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const mandatory = isMandatory(input.type)

    const settings = await getNotificationSettings()
    const adminDisabled =
      !settings.enabled || settings.disabledTypes.includes(input.type)
    if (adminDisabled && !mandatory) return

    const channels = await resolveChannels(
      input.userId,
      input.type,
      input.channels
    )
    if (channels.length === 0) return

    const payload = {
      userId: input.userId,
      type: input.type,
      category: categoryOf(input.type),
      title: input.title,
      body: input.body,
      url: input.url,
      data: input.data,
    }

    // Ogni canale è isolato: il fallimento di uno (es. coda email giù) non
    // impedisce gli altri (es. l'in-app).
    await Promise.all(
      channels.map((ch) =>
        sinks[ch].deliver(payload).catch((error) => {
          logger.error(`Canale notifica "${ch}" fallito`, error)
        })
      )
    )
  } catch (error) {
    logger.error("Notifica non inviata", error)
  }
}

// --- Lettura / aggiornamento (utente, ownership) ----------------------------

export type NotificationView = {
  id: string
  type: string
  category: string
  title: string
  body: string
  url: string | null
  data: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

function toView(n: Notification): NotificationView {
  const data = (n.data as Record<string, unknown> | null) ?? null
  const url = typeof data?.url === "string" ? data.url : null
  return {
    id: n.id,
    type: n.type,
    category: n.category,
    title: n.title,
    body: n.body,
    url,
    data,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  }
}

/**
 * Elenco paginato delle notifiche dell'utente, dalla più recente. Mostra ciò che
 * esiste entro la retention (il pruning ha già rimosso le lette scadute).
 * L'autorizzazione è per OWNERSHIP: filtra sempre per `userId`.
 */
export async function listNotifications(
  userId: string,
  opts: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<{ entries: NotificationView[]; total: number; unread: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)
  const offset = Math.max(opts.offset ?? 0, 0)

  const where: Prisma.NotificationWhereInput = { userId }
  if (opts.unreadOnly) where.readAt = null

  const [rows, total, unread] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])

  return { entries: rows.map(toView), total, unread }
}

/** Conteggio delle non lette (per il badge della campanella). */
export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } })
}

/**
 * Marca una notifica come letta. Filtra per `userId` (ownership): se la notifica
 * non esiste o è di un altro utente, è un no-op (nessun leak di esistenza).
 * Ritorna il numero di righe aggiornate.
 */
export async function markRead(userId: string, id: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  })
  return count
}

/** Marca come lette tutte le non lette dell'utente. Ritorna quante. */
export async function markAllRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
  return count
}

/**
 * Pruning di retention: cancella solo le notifiche GIÀ LETTE più vecchie di
 * `retentionDays`. Le NON lette non scadono mai per età, così un utente assente a
 * lungo non perde notifiche mai viste. È l'UNICO punto che cancella notifiche,
 * ed è un'operazione di SISTEMA (worker). `retentionDays <= 0` = conserva tutto
 * (no-op). Ritorna il numero di righe eliminate.
 */
export async function pruneNotifications(retentionDays: number): Promise<number> {
  if (retentionDays <= 0) return 0
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const { count } = await prisma.notification.deleteMany({
    where: { readAt: { not: null }, createdAt: { lt: cutoff } },
  })
  return count
}
