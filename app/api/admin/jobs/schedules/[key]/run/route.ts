import { ok, safeHandler } from "@/lib/api"
import { requireJobsPermission } from "@/lib/jobs/authz"
import { runScheduleNow } from "@/lib/jobs"

// POST /api/admin/jobs/schedules/[key]/run — "esegui ora": accoda subito
// un'esecuzione della schedulazione, senza aspettare il cron. Vedi lib/jobs.
export const POST = safeHandler(async (_request, context) => {
  await requireJobsPermission("create")
  const { key } = await (context as { params: Promise<{ key: string }> }).params
  const job = await runScheduleNow(decodeURIComponent(key))
  return ok(job, { status: 201 })
})
