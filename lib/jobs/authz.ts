import { forbidden, unauthorized } from "@/lib/api"
import { getSession, hasPermission } from "@/lib/auth-helpers"

// Guard per le route admin delle operazioni in background. L'autorizzazione è
// per RBAC, sulla risorsa `jobs` definita in lib/permissions.ts: solo gli admin
// la possiedono. Distingue 401 (non autenticato) da 403 (senza permesso).
export async function requireJobsPermission(
  action: "read" | "create" | "cancel"
): Promise<void> {
  const session = await getSession()
  if (!session) throw unauthorized()
  if (!(await hasPermission({ jobs: [action] }))) throw forbidden()
}
