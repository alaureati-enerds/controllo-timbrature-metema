import type { JobHandler } from "@/lib/jobs/types"
import { pruneNotifications } from "@/lib/notifications"
import { getNotificationSettings } from "@/lib/settings/notifications"

// Operazione di RETENTION delle notifiche: cancella le notifiche GIÀ LETTE più
// vecchie del periodo configurato (config notifiche, campo `retentionDays`). Le
// NON lette non vengono mai eliminate per età. È l'unico punto che cancella
// notifiche, ed è un'operazione di SISTEMA: gira nel worker, di norma schedulata
// via cron una volta al giorno (vedi worker.ts). Gemello di audit-prune. Vedi
// docs/notifiche.md.
export const notificationPruneHandler: JobHandler<Record<string, never>> = {
  type: "notification-prune",
  label: "Pulizia notifiche (retention)",
  fields: [],
  parse: () => ({}),
  async run(_payload, ctx) {
    const { retentionDays } = await getNotificationSettings()
    if (retentionDays <= 0) {
      await ctx.log("Retention illimitata (0): nessuna notifica da eliminare.")
      return
    }
    await ctx.log(
      `Elimino le notifiche lette più vecchie di ${retentionDays} giorni…`
    )
    const deleted = await pruneNotifications(retentionDays)
    await ctx.report(100, `${deleted} notifiche eliminate`)
    await ctx.log(`Completato: ${deleted} notifiche eliminate.`)
  },
}
