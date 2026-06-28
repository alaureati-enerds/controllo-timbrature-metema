import type { NotificationSettings } from "@/lib/settings/schema"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"

// Service della config delle NOTIFICHE (lato admin). Vive nel blob del singleton
// (campo `notifications` di lib/settings/schema.ts), server-only. Gemello di
// lib/settings/audit.ts: tiene fuori dai route handler e dalla facade la
// lettura/scrittura della configurazione. L'autorizzazione (solo admin) sta a
// monte nei route handler, non qui. Vedi docs/notifiche.md.

/**
 * Config notifiche corrente. La legge `notify()` a ogni evento per decidere se
 * creare la notifica: è un SELECT su singola riga indicizzata (il singleton),
 * deduplicato per-richiesta dal `cache()` di getSystemSettings. Trascurabile.
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  return (await getSystemSettings()).notifications
}

/**
 * Salva la config notifiche (merge shallow sul blob: l'oggetto `notifications`
 * viene passato completo, così non si azzerano campi). La modifica è
 * immediatamente efficace al prossimo evento (nessuna cache cross-request da
 * invalidare).
 */
export async function updateNotificationSettings(
  next: NotificationSettings
): Promise<NotificationSettings> {
  const saved = await updateSystemSettings({ notifications: next })
  return saved.notifications
}
