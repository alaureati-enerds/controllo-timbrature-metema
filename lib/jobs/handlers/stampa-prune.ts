import type { JobHandler } from "@/lib/jobs/types"
import { getStampeStoricoSettings } from "@/lib/settings/stampe-storico"
import { pruneStampeStorico } from "@/lib/timbrature/stampe-storico"

// Operazione di RETENTION dello storico stampe: elimina gli snapshot PDF più
// vecchi del periodo configurato (config storico stampe, campo
// `retentionDays`). È l'unico punto che elimina righe dello storico, ed è
// un'operazione di SISTEMA: gira nel worker, di norma schedulata via cron una
// volta al giorno (vedi worker.ts). Gemello di audit-prune. Vedi
// docs/stampa-timbrature.md.
export const stampaPruneHandler: JobHandler<Record<string, never>> = {
  type: "stampa-prune",
  label: "Pulizia storico stampe (retention)",
  fields: [],
  parse: () => ({}),
  async run(_payload, ctx) {
    const { retentionDays } = await getStampeStoricoSettings()
    if (retentionDays <= 0) {
      await ctx.log("Retention illimitata (0): nessuna stampa da eliminare.")
      return
    }
    await ctx.log(`Elimino le stampe più vecchie di ${retentionDays} giorni…`)
    const deleted = await pruneStampeStorico(retentionDays)
    await ctx.report(100, `${deleted} stampe eliminate`)
    await ctx.log(`Completato: ${deleted} stampe eliminate.`)
  },
}
