import { auditPruneHandler } from "@/lib/jobs/handlers/audit-prune"
import { demoHandler } from "@/lib/jobs/handlers/demo"
import { notificationEmailHandler } from "@/lib/jobs/handlers/notification-email"
import { notificationPruneHandler } from "@/lib/jobs/handlers/notification-prune"
import type { JobHandler } from "@/lib/jobs/types"

// Registro dei tipi di job: la mappa `type → handler`. È il punto di
// ESTENDIBILITÀ, gemello di lib/search/sources.ts e dello switch dei driver
// email/storage.
//
// Per aggiungere un'operazione in background:
//   1. crea un handler in lib/jobs/handlers/<nome>.ts (vedi demo.ts come modello);
//   2. aggiungilo all'array qui sotto.
// Né il worker, né la coda, né la UI vanno modificati. Vedi
// docs/operazioni-in-background.md per la guida completa.
const handlers: JobHandler[] = [
  demoHandler,
  auditPruneHandler,
  notificationEmailHandler,
  notificationPruneHandler,
]

// Indicizzati per `type` per il dispatch nel worker.
export const jobHandlers: Record<string, JobHandler> = Object.fromEntries(
  handlers.map((h) => [h.type, h])
)

// Elenco { type, label, fields } per popolare la UI: selezione del tipo e
// generazione del form di input dalla "maschera". Non espone run/parse.
export const jobTypes = handlers.map(({ type, label, fields }) => ({
  type,
  label,
  fields,
}))

export function getHandler(type: string): JobHandler | undefined {
  return jobHandlers[type]
}
