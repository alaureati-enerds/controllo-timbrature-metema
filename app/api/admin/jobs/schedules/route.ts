import { z } from "zod"

import { ok, parseJson, safeHandler } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { requireJobsPermission } from "@/lib/jobs/authz"
import { listSchedules, scheduleJob } from "@/lib/jobs"

// Schedulazioni cron gestite da UI. Protette per RBAC (risorsa `jobs`). Una
// schedulazione accoda un job allo scattare del cron; non esegue nulla da sé.

const createSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
  cron: z.string().min(1),
  // Fuso orario IANA (es. "Europe/Rome") per interpretare il cron. Default UTC.
  tz: z.string().min(1).optional(),
  // Nome univoco della schedulazione (è la `key` pg-boss): ricrearne una con lo
  // stesso nome la aggiorna. Slug semplice per evitare chiavi ambigue.
  name: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, "Usa solo lettere, numeri, punto, trattino, underscore"),
})

// GET /api/admin/jobs/schedules — elenca le schedulazioni attive.
export const GET = safeHandler(async () => {
  await requireJobsPermission("read")
  return ok(await listSchedules())
})

// POST /api/admin/jobs/schedules — crea/aggiorna una schedulazione.
export const POST = safeHandler(async (request) => {
  await requireJobsPermission("create")
  const session = await getSession() // non-null: il permesso lo garantisce
  const { type, payload, cron, tz, name } = await parseJson(request, createSchema)
  // `userId` dalla SESSIONE (non dal client): i job schedulati che operano su
  // dati utente (es. notification-email) opereranno per conto di chi ha schedulato.
  await scheduleJob({
    type,
    payload: { ...(payload ?? {}), userId: session!.user.id },
    cron,
    tz,
    key: name,
  })
  return ok(await listSchedules(), { status: 201 })
})
