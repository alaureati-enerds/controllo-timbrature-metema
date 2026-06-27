import { pruneAuditLogs } from "@/lib/audit"
import type { JobHandler } from "@/lib/jobs/types"
import { getAuditSettings } from "@/lib/settings/audit"

// Operazione di RETENTION dell'audit log: cancella le righe più vecchie del
// periodo configurato (config audit, campo `retentionDays`). È l'unico punto che
// elimina audit log, ed è un'operazione di SISTEMA: gira nel worker, di norma
// schedulata via cron una volta al giorno (vedi worker.ts). Non richiede input
// dall'utente. Vedi docs/audit-logging.md.
export const auditPruneHandler: JobHandler<Record<string, never>> = {
  type: "audit-prune",
  label: "Pulizia audit log (retention)",
  fields: [],
  parse: () => ({}),
  async run(_payload, ctx) {
    const { retentionDays } = await getAuditSettings()
    if (retentionDays <= 0) {
      await ctx.log("Retention illimitata (0): nessuna riga da eliminare.")
      return
    }
    await ctx.log(`Elimino le righe più vecchie di ${retentionDays} giorni…`)
    const deleted = await pruneAuditLogs(retentionDays)
    await ctx.report(100, `${deleted} righe eliminate`)
    await ctx.log(`Completato: ${deleted} righe eliminate.`)
  },
}
