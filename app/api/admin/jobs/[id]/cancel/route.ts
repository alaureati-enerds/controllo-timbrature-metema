import { ok, safeHandler } from "@/lib/api"
import { requireJobsPermission } from "@/lib/jobs/authz"
import { cancel } from "@/lib/jobs"

// POST /api/admin/jobs/[id]/cancel — richiede lo STOP di un job (cancellazione
// cooperativa). Imposta solo il flag: il job in coda non partirà, quello in
// esecuzione si fermerà al prossimo checkpoint dell'handler. No-op se è già
// terminato. Vedi lib/jobs/index.ts.
export const POST = safeHandler(async (_request, context) => {
  await requireJobsPermission("cancel")
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const job = await cancel(id)
  return ok(job)
})
