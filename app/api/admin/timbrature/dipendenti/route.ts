import { ApiError, ok, safeHandler } from "@/lib/api"
import { listDipendentiNascosti } from "@/lib/dipendenti/nascosti"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import { listDipendenti } from "@/lib/mysql/timbrature"

export const GET = safeHandler(async () => {
  await requireTimbraturePermission("read")
  try {
    const [dipendenti, nascosti] = await Promise.all([
      listDipendenti(),
      listDipendentiNascosti(),
    ])
    const nascostiSet = new Set(nascosti)
    return ok(dipendenti.filter((d) => !nascostiSet.has(d.codice)))
  } catch (error) {
    const detail = error instanceof Error ? error.message : "errore sconosciuto"
    throw new ApiError(`Impossibile leggere i dipendenti: ${detail}`, 502)
  }
})
