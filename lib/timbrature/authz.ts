import { forbidden, unauthorized } from "@/lib/api"
import { getSession, hasPermission } from "@/lib/auth-helpers"

// Guard per le route admin che leggono le timbrature (MySQL esterno) o ne
// scrivono le correzioni. Autorizzazione per RBAC sulla risorsa dedicata
// `timbrature` definita in lib/permissions.ts, distinta da `settings`.
export async function requireTimbraturePermission(
  action: "read" | "update"
): Promise<void> {
  const session = await getSession()
  if (!session) throw unauthorized()
  if (!(await hasPermission({ timbrature: [action] }))) throw forbidden()
}
