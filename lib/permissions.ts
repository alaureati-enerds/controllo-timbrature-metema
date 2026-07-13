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
  // Impostazioni di sistema (globali): solo gli admin le leggono/modificano dal
  // pannello. NB: vale solo per le impostazioni GLOBALI; le preferenze
  // per-utente useranno l'ownership, non questo permesso.
  settings: ["read", "update"],
  // Operazioni in background (job): chi le vede, le avvia e le ferma dal pannello
  // admin. Vedi lib/jobs/ e docs/operazioni-in-background.md.
  jobs: ["read", "create", "cancel"],
  // Audit log: chi può consultare il registro e configurarlo. La SCRITTURA non
  // è un'azione utente (avviene server-side via lib/audit/), quindi non c'è un
  // permesso "create". Vedi lib/audit/ e docs/audit-logging.md.
  audit: ["read", "configure"],
  // Timbrature dei dipendenti (dato MySQL esterno) e relative correzioni
  // locali: risorsa dedicata, distinta da `settings` (impostazioni globali di
  // sistema) perché in futuro potrebbe essere concessa a un ruolo più
  // granulare (es. "HR") senza dargli accesso a SMTP/MySQL/config.
  timbrature: ["read", "update"],
  // Preset di orario (collezione di record, con create/delete reali): risorsa
  // dedicata, distinta da `timbrature` (che è sola lettura + upsert delle
  // correzioni). Vedi lib/timbrature/preset.ts e docs/analisi-timbrature-correzioni.md.
  presets: ["read", "create", "update", "delete"],
} as const

export const ac = createAccessControl(statement)

// Ruolo base: l'utente non ha permessi RBAC dedicati (le sue risorse, come i
// file, usano l'autorizzazione per ownership, non questo sistema).
export const user = ac.newRole({})

// Ruolo amministratore: tutti i permessi di gestione utenti/sessioni +
// configurazione delle impostazioni di sistema.
export const admin = ac.newRole({
  ...adminAc.statements,
  settings: ["read", "update"],
  jobs: ["read", "create", "cancel"],
  audit: ["read", "configure"],
  timbrature: ["read", "update"],
  presets: ["read", "create", "update", "delete"],
})

// Ruoli esposti all'app. La chiave è il valore salvato in `user.role`.
export const roles = { admin, user }

export type AppRole = keyof typeof roles
