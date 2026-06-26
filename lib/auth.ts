import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { admin, twoFactor } from "better-auth/plugins"

import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
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
  // qualsiasi porta (Next sceglie 3001/3002 se la 3000 è occupata); in
  // produzione restringiamo all'URL configurato.
  trustedOrigins:
    env.NODE_ENV === "production"
      ? env.BETTER_AUTH_URL
        ? [env.BETTER_AUTH_URL]
        : []
      : ["http://localhost:*", "http://127.0.0.1:*"],

  emailAndPassword: {
    enabled: true,
    // L'utente deve verificare l'email prima di poter accedere.
    requireEmailVerification: true,
    // Invio email reale rinviato: per ora il link di reset finisce nei log.
    sendResetPassword: async ({ user, url }) => {
      logger.info(
        `[email:reset-password] destinatario=${user.email} link=${url}`
      )
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    // Per ora il link di verifica finisce nei log (vedi piano: provider dopo).
    sendVerificationEmail: async ({ user, url }) => {
      logger.info(`[email:verify] destinatario=${user.email} link=${url}`)
    },
  },

  // Flussi self-service legati all'account utente.
  user: {
    // Cambio email: la conferma viene inviata alla NUOVA email (in dev: log).
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        logger.info(
          `[email:change] ${user.email} -> ${newEmail} link=${url}`
        )
      },
    },
    // Eliminazione account: richiede conferma via link (in dev: log).
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        logger.info(`[email:delete-account] ${user.email} link=${url}`)
      },
    },
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
