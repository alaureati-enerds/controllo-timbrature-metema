import { APIError } from "better-auth/api"

import { notify } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"

// Genera le NOTIFICHE di sicurezza dagli eventi di Better Auth, in parallelo
// all'audit log (lib/audit/auth-hooks.ts): stessi punti di intercettazione, scopi
// diversi (l'audit registra in modo forense, le notifiche AVVISANO l'utente).
// È la funzione COMPOSTA in `hooks.after` di Better Auth, vedi lib/auth.ts.
//
// Tutti i tipi qui sono OBBLIGATORI (catalogo `mandatory`): l'in-app non si
// disattiva. AGGIUNGERE una notifica per un altro endpoint = un `case` qui + la
// voce nel catalogo (lib/notifications/catalog.ts). Vedi docs/notifiche.md.

type SessionUser = { id: string; email?: string }

type AfterCtx = {
  path: string
  body?: Record<string, unknown> | null
  request?: Request
  context: {
    returned?: unknown
    newSession?: { user?: SessionUser } | null
    session?: { user?: SessionUser } | null
  }
}

// Orario leggibile (Europe/Rome) per il corpo delle notifiche.
function nowLabel(): string {
  return new Date().toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  })
}

/**
 * Euristica "nuovo dispositivo" SENZA tabelle aggiuntive: dato lo user-agent
 * della richiesta di login, è un nuovo dispositivo se l'utente non ha ALTRE
 * sessioni con lo stesso user-agent oltre a quella appena creata. Pragmatica:
 * niente fingerprint sofisticati, ma sufficiente come segnale di sicurezza. Se
 * lo user-agent manca, non avvisiamo (evita falsi positivi rumorosi).
 */
async function isNewDevice(userId: string, userAgent: string | null): Promise<boolean> {
  if (!userAgent) return false
  const seen = await prisma.session.count({
    where: { userId, userAgent },
  })
  // 1 = solo la sessione appena creata da questo login → dispositivo nuovo.
  return seen <= 1
}

export async function runNotifyAfter(ctxRaw: {
  request?: Request
  [k: string]: unknown
}): Promise<void> {
  const ctx = ctxRaw as unknown as AfterCtx
  // Le notifiche scattano solo sui SUCCESSI (un'azione fallita non è accaduta).
  if (ctx.context.returned instanceof APIError) return

  const session = ctx.context.session?.user
  const userAgent = ctx.request?.headers.get("user-agent") ?? null

  switch (ctx.path) {
    case "/sign-in/email": {
      const user = ctx.context.newSession?.user
      if (!user?.id) return
      if (!(await isNewDevice(user.id, userAgent))) return
      await notify({
        type: "auth.login.new_device",
        userId: user.id,
        title: "Nuovo accesso al tuo account",
        body: `Rilevato un accesso da un dispositivo non riconosciuto il ${nowLabel()}. Se non sei stato tu, cambia subito la password.`,
        url: "/profile",
      })
      return
    }

    case "/change-password": {
      if (!session?.id) return
      await notify({
        type: "account.password.change",
        userId: session.id,
        title: "Password modificata",
        body: `La password del tuo account è stata cambiata il ${nowLabel()}. Se non sei stato tu, reimpostala subito.`,
        url: "/profile",
      })
      return
    }

    case "/change-email": {
      if (!session?.id) return
      const newEmail =
        typeof ctx.body?.newEmail === "string" ? ctx.body.newEmail : null
      await notify({
        type: "account.email.change",
        userId: session.id,
        title: "Email modificata",
        body: newEmail
          ? `È stata richiesta la modifica dell'email del tuo account in ${newEmail}.`
          : "L'indirizzo email del tuo account è stato modificato.",
        url: "/profile",
      })
      return
    }

    case "/two-factor/enable": {
      if (!session?.id) return
      await notify({
        type: "account.2fa.enable",
        userId: session.id,
        title: "Verifica in due passaggi attivata",
        body: "Hai attivato la verifica in due passaggi (2FA) sul tuo account.",
        url: "/profile",
      })
      return
    }

    case "/two-factor/disable": {
      if (!session?.id) return
      await notify({
        type: "account.2fa.disable",
        userId: session.id,
        title: "Verifica in due passaggi disattivata",
        body: "Hai disattivato la verifica in due passaggi (2FA). Il tuo account è ora meno protetto.",
        url: "/profile",
      })
      return
    }

    default:
      return
  }
}
