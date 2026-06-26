import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

// Definizione dell'RBAC granulare (access control) usato dal plugin admin di
// Better Auth, sia lato server (lib/auth.ts) sia lato client (lib/auth-client.ts).
//
// Uno "statement" elenca, per ogni risorsa, le azioni possibili. I ruoli sono
// insiemi di azioni concesse. Per aggiungere una risorsa o un'azione basta
// estendere `statement` e aggiornare i ruoli qui sotto: il controllo dei
// permessi (auth.api.hasPermission / authClient.admin.hasPermission) si adegua.

const statement = {
  // Risorse di sistema (gestione utenti/sessioni) fornite dal plugin admin.
  ...defaultStatements,
  // Risorsa di dominio d'esempio.
  note: ["create", "read", "update", "delete"],
  // Impostazioni di sistema (globali): solo gli admin le leggono/modificano dal
  // pannello. NB: vale solo per le impostazioni GLOBALI; le preferenze
  // per-utente useranno l'ownership, non questo permesso.
  settings: ["read", "update"],
} as const

export const ac = createAccessControl(statement)

// Ruolo base: l'utente gestisce solo le proprie note.
export const user = ac.newRole({
  note: ["create", "read", "update", "delete"],
})

// Ruolo amministratore: tutti i permessi di gestione utenti/sessioni + note +
// configurazione delle impostazioni di sistema.
export const admin = ac.newRole({
  ...adminAc.statements,
  note: ["create", "read", "update", "delete"],
  settings: ["read", "update"],
})

// Ruoli esposti all'app. La chiave è il valore salvato in `user.role`.
export const roles = { admin, user }

export type AppRole = keyof typeof roles
