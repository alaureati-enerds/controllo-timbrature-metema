import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { createAuthMiddleware } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { admin, twoFactor } from "better-auth/plugins"

import { runAuditAfter } from "@/lib/audit/auth-hooks"
import {
  sendChangeEmailConfirmation,
  sendDeleteAccountVerification,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "@/lib/email/auth-emails"
import { env } from "@/lib/env"
import { runNotifyAfter } from "@/lib/notifications/auth-hooks"
import { ac, roles } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

// Istanza server di Better Auth: gestisce registrazione, login, sessioni,
// verifica email e reset password, salvando tutto nel nostro PostgreSQL via
// Prisma. È il punto di verità dell'autenticazione lato server.
export const auth = betterAuth({
  // In dev `baseURL` resta undefined: Better Auth inferisce l'host dalla
  // richiesta (porta reale del dev server). In produzione usa BETTER_AUTH_URL.
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Origini accettate per login/CSRF. In sviluppo consentiamo localhost su una
  // qualsiasi porta (Next sceglie 3001/3002 se la 3000 è occupata) e gli IP di
  // LAN più comuni, così l'app è raggiungibile da smartphone sulla stessa rete;
  // in produzione restringiamo all'URL configurato.
  trustedOrigins:
    env.NODE_ENV === "production"
      ? env.BETTER_AUTH_URL
        ? [env.BETTER_AUTH_URL]
        : []
      : [
          "http://localhost:*",
          "http://127.0.0.1:*",
          "http://192.168.*.*:*",
          "http://10.0.0.*:*",
        ],

  emailAndPassword: {
    enabled: true,
    // L'utente deve verificare l'email prima di poter accedere.
    requireEmailVerification: true,
    // Link di reset password inviato via il driver email attivo (lib/email/).
    sendResetPassword: ({ user, url }) =>
      sendResetPasswordEmail({ to: user.email, userName: user.name, url }),
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    // Link di verifica inviato via il driver email attivo (lib/email/).
    sendVerificationEmail: ({ user, url }) =>
      sendVerificationEmail({ to: user.email, userName: user.name, url }),
  },

  // Flussi self-service legati all'account utente.
  user: {
    // Cambio email: la conferma viene inviata alla NUOVA email.
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: ({ user, newEmail, url }) =>
        sendChangeEmailConfirmation({
          to: newEmail,
          userName: user.name,
          newEmail,
          url,
        }),
    },
    // Eliminazione account: richiede conferma via link.
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: ({ user, url }) =>
        sendDeleteAccountVerification({
          to: user.email,
          userName: user.name,
          url,
        }),
    },
  },

  // Un unico hook DOPO ogni endpoint alimenta due sistemi paralleli e fail-open
  // (nessuno dei due può far fallire un'operazione di Better Auth):
  //  - AUDIT LOG: registra gli eventi di sicurezza (login ok/fallito, logout,
  //    cambio password/email, 2FA, azioni admin) — lib/audit/auth-hooks.ts;
  //  - NOTIFICHE: avvisa l'utente degli eventi di sicurezza che lo riguardano
  //    (nuovo accesso, password/email/2FA) — lib/notifications/auth-hooks.ts.
  // Better Auth accetta un solo `after`: qui li componiamo, isolando ciascuno.
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      await runAuditAfter(ctx).catch(() => {})
      await runNotifyAfter(ctx).catch(() => {})
    }),
  },

  // Rate limiting integrato: protegge gli endpoint auth da abusi/brute force.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },

  plugins: [
    // RBAC + gestione utenti (lista, creazione manuale, ruoli, ban).
    admin({
      ac,
      roles,
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    // Autenticazione a due fattori (opt-in, self-service dal profilo). Offriamo
    // solo TOTP (app authenticator) + codici di backup: nessun OTP via email,
    // coerente con il fatto che in dev le email finiscono solo nei log.
    // `issuer` è il nome mostrato nell'app authenticator dell'utente.
    twoFactor({
      issuer: "shadcn-starter",
    }),
    // Deve restare l'ULTIMO plugin: gestisce i cookie in ambiente Next.js.
    nextCookies(),
  ],
})
