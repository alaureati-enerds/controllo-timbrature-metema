import { z } from "zod"

import { ok, parseJson, safeHandler } from "@/lib/api"
import { requireJobsPermission } from "@/lib/jobs/authz"
import { enqueue, listJobs } from "@/lib/jobs"
import { jobTypes } from "@/lib/jobs/registry"

// Endpoint admin delle operazioni in background. Protetto per RBAC (risorsa
// `jobs`, vedi lib/permissions.ts): non per ownership. La UI legge da qui in
// polling (vedi components/admin/jobs-manager.tsx).

const statusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
])

const enqueueSchema = z.object({
  type: z.string().min(1),
  // Payload libero: la VALIDAZIONE vera è dell'handler (handler.parse in
  // enqueue), che conosce la forma attesa per il proprio tipo.
  payload: z.unknown().optional(),
})

// GET /api/admin/jobs — elenca i job (filtri opzionali ?status, ?type) e i tipi
// disponibili per l'avvio manuale.
export const GET = safeHandler(async (request) => {
  await requireJobsPermission("read")
  const params = new URL(request.url).searchParams
  const status = statusSchema.safeParse(params.get("status") ?? undefined)
  const type = params.get("type") ?? undefined
  const jobs = await listJobs({
    status: status.success ? status.data : undefined,
    type: type ?? undefined,
  })
  return ok({ jobs, types: jobTypes })
})

// POST /api/admin/jobs — accoda una nuova operazione.
export const POST = safeHandler(async (request) => {
  await requireJobsPermission("create")
  const { type, payload } = await parseJson(request, enqueueSchema)
  const job = await enqueue(type, payload ?? {})
  return ok(job, { status: 201 })
})
