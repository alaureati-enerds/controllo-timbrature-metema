import { forbidden, unauthorized } from "@/lib/api"
import { getSession, hasPermission } from "@/lib/auth-helpers"

// Guard per le route admin dell'audit log. L'autorizzazione è per RBAC, sulla
// risorsa `audit` definita in lib/permissions.ts: solo gli admin la possiedono.
// Distingue 401 (non autenticato) da 403 (autenticato ma senza permesso).
//   - "read"      → consultare il registro
//   - "configure" → modificarne la configurazione (toggle, retention)
export async function requireAuditPermission(
  action: "read" | "configure"
): Promise<void> {
  const session = await getSession()
  if (!session) throw unauthorized()
  if (!(await hasPermission({ audit: [action] }))) throw forbidden()
}
