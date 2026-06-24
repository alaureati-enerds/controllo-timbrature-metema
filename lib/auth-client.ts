import { adminClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { ac, roles } from "@/lib/permissions"

// Client di Better Auth per i Client Component: espone signIn/signUp/signOut,
// useSession e le azioni admin (listUsers, createUser, setRole, ban, ...).
// Gli stessi ruoli/permessi del server (lib/permissions.ts) sono passati al
// plugin admin per i controlli lato client.
export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles })],
})

export const { signIn, signUp, signOut, useSession } = authClient
