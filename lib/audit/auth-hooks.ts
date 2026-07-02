import { APIError, createAuthMiddleware } from "better-auth/api"

import { audit, type AuditInput } from "@/lib/audit"

// Cattura CENTRALIZZATA degli eventi di sicurezza di Better Auth. È un singolo
// `hooks.after` (vedi lib/auth.ts) che gira DOPO ogni endpoint di Better Auth —
// anche quando l'endpoint fallisce (l'errore finisce in `ctx.context.returned`),
// così possiamo registrare sia i successi sia i fallimenti (es. login falliti).
//
// Mappiamo il `path` dell'endpoint a un evento del catalogo (lib/audit/catalog.ts).
// Per AGGIUNGERE la tracciatura di un altro endpoint di Better Auth: aggiungi un
// `case` in buildEvent() con la `action` corrispondente. Per gli eventi NON di
// Better Auth (azioni di dominio nei tuoi route handler) chiama invece `audit()`
// direttamente — vedi gli esempi in app/api/admin/. Vedi docs/audit-logging.md.

// Vista minimale e difensiva del context dell'after-hook: prendiamo solo ciò che
// ci serve, senza dipendere dai tipi interni di Better Auth.
type AfterCtx = {
  path: string
  body?: Record<string, unknown> | null
  request?: Request
  context: {
    returned?: unknown
    newSession?: { user?: { id: string; email?: string } } | null
    session?: { user?: { id: string; email?: string } } | null
  }
}

type SessionUser = { id: string; email?: string }

function actorFrom(user?: SessionUser | null): Pick<AuditInput, "actorId" | "actorEmail"> {
  return { actorId: user?.id ?? null, actorEmail: user?.email ?? null }
}

// Costruisce l'evento di audit per la richiesta corrente, o null se l'endpoint
// non è tra quelli tracciati. `failed` = l'endpoint ha restituito un errore.
function buildEvent(ctx: AfterCtx, failed: boolean): AuditInput | null {
  const session = ctx.context.session?.user
  const body = ctx.body ?? {}
  // userId del bersaglio nelle azioni admin (set-role, ban, ...).
  const targetUserId = typeof body.userId === "string" ? body.userId : undefined
  const targetUser = targetUserId
    ? { type: "user" as const, id: targetUserId }
    : undefined

  switch (ctx.path) {
    // --- Autenticazione: tracciamo SUCCESSO e FALLIMENTO ---------------------
    case "/sign-in/email":
      if (failed) {
        return {
          action: "auth.login.failure",
          outcome: "failure",
          target:
            typeof body.email === "string"
              ? { type: "credentials", label: body.email }
              : undefined,
        }
      }
      return {
        action: "auth.login.success",
        ...actorFrom(ctx.context.newSession?.user),
      }

    case "/sign-out":
      return { action: "auth.logout", ...actorFrom(session) }

    // --- Account self-service: solo successo ---------------------------------
    case "/change-password":
      return failed ? null : { action: "account.password.change", ...actorFrom(session) }
    case "/change-email":
      return failed
        ? null
        : {
            action: "account.email.change",
            ...actorFrom(session),
            metadata:
              typeof body.newEmail === "string" ? { to: body.newEmail } : undefined,
          }
    case "/two-factor/enable":
      return failed ? null : { action: "account.2fa.enable", ...actorFrom(session) }
    case "/two-factor/disable":
      return failed ? null : { action: "account.2fa.disable", ...actorFrom(session) }
    case "/delete-user":
      return failed ? null : { action: "account.delete", ...actorFrom(session) }

    // --- Gestione utenti (admin): solo successo -----------------------------
    case "/admin/create-user": {
      if (failed) return null
      const created = (ctx.context.returned as { user?: SessionUser } | undefined)?.user
      return {
        action: "users.create",
        ...actorFrom(session),
        target: created
          ? { type: "user", id: created.id, label: created.email }
          : undefined,
      }
    }
    case "/admin/remove-user":
      return failed ? null : { action: "users.remove", ...actorFrom(session), target: targetUser }
    case "/admin/ban-user":
      return failed
        ? null
        : {
            action: "users.ban",
            ...actorFrom(session),
            target: targetUser,
            metadata:
              typeof body.banReason === "string" ? { reason: body.banReason } : undefined,
          }
    case "/admin/unban-user":
      return failed ? null : { action: "users.unban", ...actorFrom(session), target: targetUser }
    case "/admin/set-role":
      return failed
        ? null
        : {
            action: "users.role.change",
            ...actorFrom(session),
            target: targetUser,
            metadata: body.role !== undefined ? { role: body.role } : undefined,
          }
    case "/admin/impersonate-user":
      return failed
        ? null
        : { action: "users.impersonate", ...actorFrom(session), target: targetUser, metadata: { mode: "start" } }
    case "/admin/stop-impersonating":
      return failed
        ? null
        : { action: "users.impersonate", ...actorFrom(session), metadata: { mode: "stop" } }

    default:
      return null
  }
}

// Logica dell'after-hook, estratta come funzione così da poterla COMPORRE con
// l'hook delle notifiche (Better Auth accetta un solo `hooks.after`): vedi la
// composizione in lib/auth.ts. `ctx.request` serve a ricavare IP/user-agent.
export async function runAuditAfter(ctx: {
  request?: Request
  [k: string]: unknown
}): Promise<void> {
  const afterCtx = ctx as unknown as AfterCtx
  const failed = afterCtx.context.returned instanceof APIError
  const event = buildEvent(afterCtx, failed)
  if (!event) return
  // FAIL-OPEN: audit() non lancia mai, ma per sicurezza non blocchiamo comunque
  // il flusso di Better Auth se qualcosa andasse storto qui.
  await audit({ ...event, request: ctx.request }).catch(() => {})
}

// Middleware da comporre in `hooks.after` di Better Auth (lib/auth.ts).
export const auditAfterHook = createAuthMiddleware(runAuditAfter)
