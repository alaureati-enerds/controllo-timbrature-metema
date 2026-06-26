import { adminClient, twoFactorClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { ac, roles } from "@/lib/permissions"

// Client di Better Auth per i Client Component: espone signIn/signUp/signOut,
// useSession, le azioni admin (listUsers, createUser, setRole, ban, ...) e la
// 2FA (twoFactor.enable/disable/verifyTotp, generateBackupCodes, ...).
// Gli stessi ruoli/permessi del server (lib/permissions.ts) sono passati al
// plugin admin per i controlli lato client.
//
// Il redirect al secondo fattore dopo email+password è gestito esplicitamente
// nel login-form (legge `data.twoFactorRedirect`) per preservare la
// destinazione `?redirect=`, quindi qui non impostiamo `onTwoFactorRedirect`.
export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles }), twoFactorClient()],
})

export const { signIn, signUp, signOut, useSession } = authClient
