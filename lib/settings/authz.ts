import { forbidden, unauthorized } from "@/lib/api"
import { getSession, hasPermission } from "@/lib/auth-helpers"

// Guard condiviso dalle route admin che toccano le impostazioni di sistema
// (configurazione e logo). L'autorizzazione è per RBAC, sulla risorsa
// `settings` definita in lib/permissions.ts: solo gli admin la possiedono.
export async function requireSettingsPermission(
  action: "read" | "update"
): Promise<void> {
  const session = await getSession()
  if (!session) throw unauthorized()
  if (!(await hasPermission({ settings: [action] }))) throw forbidden()
}
