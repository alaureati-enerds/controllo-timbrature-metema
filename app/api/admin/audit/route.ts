import { z } from "zod"

import { ok, safeHandler } from "@/lib/api"
import { listAuditLogs } from "@/lib/audit"
import { requireAuditPermission } from "@/lib/audit/authz"

// Endpoint di sola lettura del registro di audit. La SCRITTURA non passa da qui:
// avviene server-side via lib/audit/ (hook di Better Auth e chiamate dirette).
// Protetto dal permesso `audit.read` (solo admin). Vedi docs/audit-logging.md.

// Filtri accettati come query string. Tutti opzionali: assenti = nessun filtro.
const filtersSchema = z.object({
  category: z.string().optional(),
  action: z.string().optional(),
  outcome: z.enum(["success", "failure"]).optional(),
  actor: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

// GET /api/admin/audit — registro paginato e filtrato (solo admin)
export const GET = safeHandler(async (request) => {
  await requireAuditPermission("read")
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const filters = filtersSchema.parse(params)
  return ok(await listAuditLogs(filters))
})
