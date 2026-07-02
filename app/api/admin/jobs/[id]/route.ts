import { notFound, ok, safeHandler } from "@/lib/api"
import { requireJobsPermission } from "@/lib/jobs/authz"
import { getJob } from "@/lib/jobs"

// GET /api/admin/jobs/[id] — stato corrente di un singolo job. La UI lo
// interroga in polling per seguire avanzamento e log del job attivo.
export const GET = safeHandler(async (_request, context) => {
  await requireJobsPermission("read")
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const job = await getJob(id)
  if (!job) throw notFound("Job non trovato")
  return ok(job)
})
