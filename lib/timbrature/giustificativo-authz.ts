import { forbidden, unauthorized } from "@/lib/api"
import { getSession, hasPermission } from "@/lib/auth-helpers"

// Guard per le route admin che gestiscono l'anagrafica dei giustificativi di
// assenza. Autorizzazione per RBAC sulla risorsa dedicata `giustificativi`
// definita in lib/permissions.ts, gemella di `presets`.
export async function requireGiustificativoPermission(
  action: "read" | "create" | "update" | "delete"
): Promise<void> {
  const session = await getSession()
  if (!session) throw unauthorized()
  if (!(await hasPermission({ giustificativi: [action] }))) throw forbidden()
}
