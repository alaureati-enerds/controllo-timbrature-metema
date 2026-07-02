import { ApiError, ok, safeHandler } from "@/lib/api"
import { requireSettingsPermission } from "@/lib/settings/authz"
import { listDipendenti } from "@/lib/mysql/timbrature"

export const GET = safeHandler(async () => {
  await requireSettingsPermission("read")
  try {
    return ok(await listDipendenti())
  } catch (error) {
    const detail = error instanceof Error ? error.message : "errore sconosciuto"
    throw new ApiError(`Impossibile leggere i dipendenti: ${detail}`, 502)
  }
})
