import { ok, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { unreadCount } from "@/lib/notifications"

// Conteggio delle notifiche non lette dell'utente corrente: alimenta il badge
// della campanella in topbar, interrogato in polling. Volutamente leggero (una
// sola COUNT su indice). Vedi docs/notifiche.md.

// GET /api/notifications/unread-count — { count }
export const GET = safeHandler(async () => {
  const session = await getSession()
  if (!session) throw unauthorized()
  return ok({ count: await unreadCount(session.user.id) })
})
