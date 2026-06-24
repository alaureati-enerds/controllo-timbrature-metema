import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"

// Helper server riusabili per leggere la sessione e applicare l'autorizzazione
// in Server Components e Route Handlers. Tengono fuori dalle pagine la logica
// ripetitiva di "chi sei e cosa puoi fare".

export type Session = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>

/** Ritorna la sessione corrente o null se l'utente non è autenticato. */
export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() })
}

/** Garantisce un utente autenticato, altrimenti reindirizza al login. */
export async function requireUser(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}

/** `user.role` può contenere più ruoli separati da virgola. */
function hasRole(role: string | null | undefined, target: string): boolean {
  if (!role) return false
  return role
    .split(",")
    .map((r) => r.trim())
    .includes(target)
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSession()
  return hasRole(session?.user.role, "admin")
}

/**
 * Garantisce un utente con il ruolo richiesto. Se non autenticato → /login,
 * se autenticato ma senza ruolo → home (niente accesso alle aree riservate).
 */
export async function requireRole(target: string): Promise<Session> {
  const session = await requireUser()
  if (!hasRole(session.user.role, target)) redirect("/")
  return session
}
