import { z } from "zod"

import type { JobHandler } from "@/lib/jobs/types"

// Handler DIMOSTRATIVO: non fa lavoro reale, simula un'operazione lunga a step
// (una pausa per ogni passo) riportando l'avanzamento. Serve a mostrare il
// meccanismo end-to-end — avvio, progresso, log, STOP cooperativo — senza
// dipendere da rete o servizi esterni. Usalo come modello per i tuoi handler.
//
// Per un caso reale (es. scrape di una pagina) la struttura è identica: un loop
// con `ctx.report()` per l'avanzamento e `ctx.throwIfCancelled()` come punto in
// cui la richiesta di stop può fermare il lavoro in modo pulito.

const payloadSchema = z.object({
  // Numero di passi da simulare e durata di ciascuno (ms). Con valori di
  // default il job dura ~10s, abbastanza da vederne l'avanzamento e provare lo
  // stop dalla UI.
  steps: z.number().int().min(1).max(100).default(10),
  stepMs: z.number().int().min(50).max(10_000).default(1_000),
})

export type DemoPayload = z.infer<typeof payloadSchema>

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const demoHandler: JobHandler<DemoPayload> = {
  type: "demo",
  label: "Operazione dimostrativa",
  parse: (raw) => payloadSchema.parse(raw),
  async run({ steps, stepMs }, ctx) {
    await ctx.log(`Avvio: ${steps} passi da ${stepMs}ms`)
    for (let i = 1; i <= steps; i++) {
      // Checkpoint: se è stato chiesto lo stop, esce pulito QUI (prima del passo).
      await ctx.throwIfCancelled()
      await sleep(stepMs)
      await ctx.report(Math.round((i / steps) * 100), `Passo ${i}/${steps}`)
    }
    await ctx.log("Completato")
  },
}
