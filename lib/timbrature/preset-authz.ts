import { forbidden, unauthorized } from "@/lib/api"
import { getSession, hasPermission } from "@/lib/auth-helpers"

// Guard per le route admin che gestiscono i preset di orario. Autorizzazione
// per RBAC sulla risorsa dedicata `presets` definita in lib/permissions.ts.
export async function requirePresetPermission(
  action: "read" | "create" | "update" | "delete"
): Promise<void> {
  const session = await getSession()
  if (!session) throw unauthorized()
  if (!(await hasPermission({ presets: [action] }))) throw forbidden()
}
