import { ok, safeHandler } from "@/lib/api"
import { requireJobsPermission } from "@/lib/jobs/authz"
import { unscheduleJob } from "@/lib/jobs"

// DELETE /api/admin/jobs/schedules/[key] — rimuove una schedulazione.
// NB: le schedulazioni definite nel codice (worker.ts) riappaiono al riavvio del
// worker: lì la fonte di verità è il codice. Vedi docs/operazioni-in-background.md.
export const DELETE = safeHandler(async (_request, context) => {
  await requireJobsPermission("cancel")
  const { key } = await (context as { params: Promise<{ key: string }> }).params
  await unscheduleJob(decodeURIComponent(key))
  return ok({ success: true })
})
