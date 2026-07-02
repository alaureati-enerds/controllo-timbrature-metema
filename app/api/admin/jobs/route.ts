import { z } from "zod"

import { ok, parseJson, safeHandler } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
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
  payload: z.record(z.string(), z.unknown()).optional(),
})

// Inietta `userId` dalla SESSIONE nel payload: l'identità non si prende mai dal
// client. Gli handler che non la dichiarano (es. demo) la ignorano (Zod la
// scarta); quelli che operano su dati dell'utente (es. crea-nota) la usano.
function withUser(
  payload: Record<string, unknown> | undefined,
  userId: string
): Record<string, unknown> {
  return { ...(payload ?? {}), userId }
}

// GET /api/admin/jobs — elenca i job (filtri opzionali ?status, ?type) e i tipi
// disponibili per l'avvio manuale.
export const GET = safeHandler(async (request) => {
  await requireJobsPermission("read")
  const params = new URL(request.url).searchParams
  const status = statusSchema.safeParse(params.get("status") ?? undefined)
  const type = params.get("type") ?? undefined
  const limit = Number.parseInt(params.get("limit") ?? "", 10)
  const offset = Number.parseInt(params.get("offset") ?? "", 10)
  const { jobs, total } = await listJobs({
    status: status.success ? status.data : undefined,
    type: type ?? undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  })
  return ok({ jobs, total, types: jobTypes })
})

// POST /api/admin/jobs — accoda una nuova operazione.
export const POST = safeHandler(async (request) => {
  await requireJobsPermission("create")
  const session = await getSession() // non-null: il permesso lo garantisce
  const { type, payload } = await parseJson(request, enqueueSchema)
  const job = await enqueue(type, withUser(payload, session!.user.id))
  return ok(job, { status: 201 })
})
