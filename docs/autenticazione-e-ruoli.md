# Autenticazione, ruoli e gestione utenti

Guida di riferimento al backend di autenticazione dello scaffold: come funziona,
come si proteggono pagine e API, come si aggiungono ruoli e permessi.

L'autenticazione è basata su **[Better Auth](https://www.better-auth.com/)**: una
libreria (non un servizio esterno) che salva **tutti i dati nel nostro
PostgreSQL** tramite Prisma. Metodo di accesso attuale: **email + password**, con
verifica email e reset password.

## I pezzi del sistema

| File | Ruolo |
| ---- | ----- |
| [lib/auth.ts](../lib/auth.ts) | Istanza server di Better Auth (punto di verità). Configura email+password, verifica/reset, rate limiting, plugin admin e 2FA. |
| [lib/auth-client.ts](../lib/auth-client.ts) | Client per i Client Component: `signIn`, `signUp`, `signOut`, `useSession`, azioni admin. |
| [lib/auth-helpers.ts](../lib/auth-helpers.ts) | Helper server: `getSession`, `requireUser`, `requireRole`, `isAdmin`. |
| [lib/permissions.ts](../lib/permissions.ts) | Definizione RBAC (risorse, azioni, ruoli `admin`/`user`). |
| [app/api/auth/[...all]/route.ts](../app/api/auth/%5B...all%5D/route.ts) | Espone tutti gli endpoint sotto `/api/auth/*`. |
| [proxy.ts](../proxy.ts) | Protezione "ottimistica" delle route (redirect a `/login` se manca il cookie). |
| [prisma/seed.ts](../prisma/seed.ts) | Crea l'admin iniziale (idempotente). |

I modelli `User`, `Session`, `Account`, `Verification` sono in
[prisma/schema.prisma](../prisma/schema.prisma). Le password sono salvate
**hashate** nel modello `Account`, mai in chiaro.

## Setup iniziale

Oltre a `DATABASE_URL`, servono le variabili in `.env` (vedi `.env.example`):

```bash
BETTER_AUTH_SECRET="..."   # genera con: openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="changeme123"
SEED_ADMIN_NAME="Admin"
```

Poi crea l'amministratore iniziale:

```bash
npm run db:seed
```

> In sviluppo **non viene inviata alcuna email reale**: i link di verifica e di
> reset password vengono **stampati nei log del server** (cerca `[email:verify]`
> e `[email:reset-password]`). Per collegare un provider reale (Resend/SMTP)
> bastano i callback `sendVerificationEmail` / `sendResetPassword` in
> [lib/auth.ts](../lib/auth.ts).

## Proteggere una pagina (Server Component)

Usa gli helper di [lib/auth-helpers.ts](../lib/auth-helpers.ts). Reindirizzano
automaticamente se l'utente non è autorizzato.

```ts
import { requireUser } from "@/lib/auth-helpers"

export default async function Page() {
  const session = await requireUser() // → /login se non autenticato
  return <p>Ciao {session.user.name}</p>
}
```

Per un'area riservata agli admin:

```ts
import { requireRole } from "@/lib/auth-helpers"

export default async function AdminPage() {
  await requireRole("admin") // → / se autenticato ma non admin
  // ...
}
```

> Il [proxy.ts](../proxy.ts) fa un primo filtro veloce (presenza del cookie), ma
> **la protezione vera è negli helper**: usali sempre nelle pagine/route riservate.

## Proteggere un Route Handler (API)

Combina gli helper di sessione con quelli di risposta in
[lib/api.ts](../lib/api.ts). Vedi l'esempio completo in
[app/api/files/route.ts](../app/api/files/route.ts):

```ts
import { ok, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"

export const GET = safeHandler(async () => {
  const session = await getSession()
  if (!session) throw unauthorized()
  return ok(await listUserFiles(session.user.id))
})
```

`safeHandler` cattura le eccezioni e uniforma le risposte di errore
(`ZodError` → 400 con dettagli, `ApiError` → status dedicato, altro → 500).

## UI lato client

Nei Client Component usa `authClient` da [lib/auth-client.ts](../lib/auth-client.ts):

```ts
import { authClient } from "@/lib/auth-client"

await authClient.signIn.email({ email, password })
await authClient.signOut()
const { data: session, isPending } = authClient.useSession()
```

Le pagine pubbliche di autenticazione sono nel route group
[app/(auth)/](<../app/(auth)>): login, registrazione, reset e verifica email.

## Aggiungere un ruolo

I ruoli sono definiti in [lib/permissions.ts](../lib/permissions.ts). Per
aggiungerne uno (es. `editor`):

1. Crea il ruolo con i permessi desiderati:
   ```ts
   export const editor = ac.newRole({ project: ["create", "read", "update"] })
   ```
2. Aggiungilo all'oggetto `roles`:
   ```ts
   export const roles = { admin, user, editor }
   ```

Il ruolo si assegna salvandolo in `user.role` (campo stringa; più ruoli separati
da virgola). Da pannello admin: `authClient.admin.setRole({ userId, role })`.

## Aggiungere una risorsa/permesso

Sempre in [lib/permissions.ts](../lib/permissions.ts), estendi `statement` con la
nuova risorsa e aggiorna i ruoli:

```ts
const statement = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete"], // nuova risorsa
} as const
```

Poi verifica i permessi dove serve, lato server o client:

```ts
await auth.api.userHasPermission({ body: { userId, permissions: { project: ["create"] } } })
```

## Self-service account (utente)

Nella pagina profilo ([app/(dashboard)/profile/page.tsx](<../app/(dashboard)/profile/page.tsx>))
oltre a nome e password l'utente gestisce, via
[components/profile/account-security.tsx](../components/profile/account-security.tsx):

- **Sessioni attive / dispositivi** — `authClient.listSessions()`,
  `authClient.revokeSession({ token })`, `authClient.revokeOtherSessions()`.
  La sessione corrente è evidenziata e non revocabile.
- **Cambio email** — `authClient.changeEmail({ newEmail, callbackURL })`. La
  conferma arriva sulla **nuova** email (in dev: nei log, tag `[email:change]`).
  Richiede `user.changeEmail.enabled` in [lib/auth.ts](../lib/auth.ts).
- **Eliminazione account** — `authClient.deleteUser({ callbackURL })` dietro
  conferma (digitare la propria email). Invia un link di conferma finale (in dev:
  log, tag `[email:delete-account]`). Richiede `user.deleteUser.enabled`.
- **Autenticazione a due fattori (2FA)** — opt-in da
  [components/profile/two-factor-card.tsx](../components/profile/two-factor-card.tsx),
  basata sul plugin `twoFactor` di Better Auth (solo TOTP + codici di backup).

## Autenticazione a due fattori (2FA)

Secondo fattore **opzionale e self-service** via app authenticator (TOTP), con
codici di backup per il recupero. Configurata in [lib/auth.ts](../lib/auth.ts)
(`twoFactor({ issuer })`) e [lib/auth-client.ts](../lib/auth-client.ts)
(`twoFactorClient()`). I dati stanno nel modello `TwoFactor`
([prisma/schema.prisma](../prisma/schema.prisma)) e nel flag
`user.twoFactorEnabled`.

**Attivazione** (wizard in 3 passi dal profilo): conferma password →
`authClient.twoFactor.enable({ password })` (restituisce `totpURI` +
`backupCodes`) → scansione del QR e verifica del primo codice con
`authClient.twoFactor.verifyTotp({ code })` → salvataggio dei codici di backup.
Better Auth attiva davvero la 2FA **solo dopo** la verifica del primo codice,
quindi un wizard interrotto non lascia l'account bloccato.

**Login** ([app/(auth)/two-factor/page.tsx](<../app/(auth)/two-factor/page.tsx>)):
quando un utente con 2FA fa login, `signIn.email` restituisce
`twoFactorRedirect: true` senza creare la sessione; il
[login-form](../components/auth/login-form.tsx) reindirizza a `/two-factor`
(rotta esclusa dal [proxy.ts](../proxy.ts)). Lì si verifica con
`verifyTotp({ code, trustDevice })` oppure `verifyBackupCode({ code })`.
`trustDevice` ricorda il dispositivo per 30 giorni.

**Gestione**: `twoFactor.disable({ password })` per disattivare,
`twoFactor.generateBackupCodes({ password })` per rigenerare i codici (i
precedenti vengono invalidati).

**Recupero da lockout (admin)**: se un utente perde telefono **e** codici di
backup, un amministratore può azzerare la 2FA dal dettaglio utente
([components/admin/user-detail.tsx](../components/admin/user-detail.tsx)),
azione "Reimposta 2FA". Chiama l'endpoint riservato
[app/api/admin/users/[id]/reset-2fa/route.ts](<../app/api/admin/users/[id]/reset-2fa/route.ts>)
che rimuove la riga `TwoFactor` e azzera `twoFactorEnabled`; l'utente potrà poi
riconfigurarla dal profilo.

## Gestione utenti (admin)

La lista ([app/(dashboard)/admin/users/page.tsx](<../app/(dashboard)/admin/users/page.tsx>),
[components/admin/users-manager.tsx](../components/admin/users-manager.tsx)) offre
creazione manuale, ricerca per email, paginazione, cambio ruolo inline, ban/sblocco
rapido ed eliminazione. Le **azioni avanzate** sono nel dettaglio utente
([app/(dashboard)/admin/users/[id]/page.tsx](<../app/(dashboard)/admin/users/[id]/page.tsx>),
[components/admin/user-detail.tsx](../components/admin/user-detail.tsx)):

- `admin.getUser({ query: { id } })` — dettaglio
- `admin.setRole({ userId, role })` — cambio ruolo
- `admin.setUserPassword({ userId, newPassword })` — reset password
- `admin.banUser({ userId, banReason?, banExpiresIn? })` / `admin.unbanUser` —
  ban con motivo e scadenza (secondi)
- `admin.listUserSessions({ userId })`, `admin.revokeUserSession({ sessionToken })`,
  `admin.revokeUserSessions({ userId })` — sessioni dell'utente
- `admin.impersonateUser({ userId })` / `admin.stopImpersonating()` —
  impersonificazione; quando attiva, il banner
  [components/impersonation-banner.tsx](../components/impersonation-banner.tsx)
  (montato nel layout dashboard) mostra "stai impersonando X" con Stop
- `admin.removeUser({ userId })` — eliminazione
- **Reimposta 2FA** — `POST /api/admin/users/[id]/reset-2fa` (endpoint custom,
  solo admin): sblocca un utente rimasto fuori avendo perso telefono e codici di
  backup (vedi *Autenticazione a due fattori*)

**Guardrail**: un admin non può bannare/eliminare/impersonare sé stesso (controllo
in UI confrontando con `authClient.useSession()`; Better Auth blocca comunque il
self-ban lato server).

## Non incluso (per ora)

Predisposto ma rinviato: invio email reale, login social/OAuth, magic link,
organizzazioni/multi-tenant, audit log persistente. Si aggiungono come plugin o
configurazione senza riscrivere le fondamenta.
