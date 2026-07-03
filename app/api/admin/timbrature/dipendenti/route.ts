import { ApiError, ok, safeHandler } from "@/lib/api"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import { listDipendenti } from "@/lib/mysql/timbrature"

export const GET = safeHandler(async () => {
  await requireTimbraturePermission("read")
  try {
    return ok(await listDipendenti())
  } catch (error) {
    const detail = error instanceof Error ? error.message : "errore sconosciuto"
    throw new ApiError(`Impossibile leggere i dipendenti: ${detail}`, 502)
  }
})
