# Audit logging (registro delle azioni)

L'audit log registra **chi** ha fatto **cosa**, **quando**, **da dove** e con
quale **esito**. Nasce per le azioni di **sicurezza** (login, gestione utenti,
cambio impostazioni) ma è **estensibile** a qualsiasi operazione del progetto.

In breve:

- **Storage append-only**: l'app scrive (`audit()`) e legge (`listAuditLogs()`),
  ma non aggiorna né cancella mai una riga. L'unica cancellazione è il **pruning
  di retention**, eseguito dal worker.
- **Configurabile dall'admin**: interruttore generale, toggle per singolo evento
  e giorni di conservazione, dalla pagina **Audit log** (`/admin/audit`).
- **Estensibile**: aggiungere un evento = una voce nel catalogo + una chiamata
  `audit()`. Nessuna migrazione.
- **Fail-open**: un errore di logging non fa mai fallire l'operazione di
  business (un login non si rompe perché il log non è scrivibile).
- **Mai segreti**: password, token e secret 2FA non vengono mai registrati. Si
  logga il *fatto* («password cambiata»), non il valore.

---

## Dove vive

| Pezzo | File |
| --- | --- |
| Modello dati (`audit_log`) | [`prisma/schema.prisma`](../prisma/schema.prisma) |
| Catalogo degli eventi (estensibilità) | [`lib/audit/catalog.ts`](../lib/audit/catalog.ts) |
| Service: scrittura, dedup, lettura, pruning | [`lib/audit/index.ts`](../lib/audit/index.ts) |
| Cattura eventi Better Auth (hook) | [`lib/audit/auth-hooks.ts`](../lib/audit/auth-hooks.ts) |
| Guard RBAC (`audit.read` / `audit.configure`) | [`lib/audit/authz.ts`](../lib/audit/authz.ts) |
| Configurazione (nel singleton settings) | [`lib/settings/audit.ts`](../lib/settings/audit.ts), [`lib/settings/schema.ts`](../lib/settings/schema.ts) |
| API: registro e configurazione | [`app/api/admin/audit/`](../app/api/admin/audit/) |
| UI: pagina, viewer, form config | [`app/(dashboard)/admin/audit/`](<../app/(dashboard)/admin/audit/>), [`components/admin/audit-log.tsx`](../components/admin/audit-log.tsx), [`components/admin/audit-settings-form.tsx`](../components/admin/audit-settings-form.tsx) |
| Retention (job + cron) | [`lib/jobs/handlers/audit-prune.ts`](../lib/jobs/handlers/audit-prune.ts), [`worker.ts`](../worker.ts) |

---

## Il modello dati

Una riga di `AuditLog` ha: `action` (chiave del catalogo), `category`, `outcome`
(`success`/`failure`), `actorId`/`actorEmail` (chi ha agito; assenti = anonimo o
azione di sistema), `target` (su cosa, `{ type, id?, label? }`), `metadata`
(contesto extra, **mai segreti**), `ip`, `userAgent`, `requestId`, `createdAt`.

`actorEmail` e `target.label` sono **denormalizzati** di proposito: il registro
deve restare leggibile anche dopo che l'utente o l'oggetto referenziato è stato
eliminato. Per questo **non** ci sono foreign key con cascade.

---

## Configurazione (lato admin)

Pagina **Audit log → Configurazione** (`/admin/audit`):

- **Registrazione attiva**: interruttore generale. Se spento, nessun evento
  viene registrato.
- **Giorni di retention**: le righe più vecchie vengono eliminate dalla pulizia
  giornaliera del worker. `0` = conserva per sempre.
- **Toggle per evento**: ogni evento del catalogo può essere spento. La logica è
  **opt-out** (`disabledActions` contiene gli eventi spenti): un evento **nuovo**
  è quindi tracciato **di default**, senza dover toccare la configurazione.

La config vive nel blob del singleton `SystemSetting` (campo `audit`), come la
config email: nessuna tabella né migrazione per aggiungere opzioni. Vedi
[impostazioni di sistema](impostazioni-di-sistema.md).

---

## Eventi anonimi e anti-flood

Gli eventi **senza utente autenticato** (es. login falliti) sono i più
interessanti per la sicurezza ma anche i più esposti al flooding sotto attacco.
Il service applica un **dedup in memoria**: eventi identici (stessa `action` +
stesso IP) entro 60 secondi vengono collassati in una sola riga. È sufficiente
per una singola istanza; con più istanze dietro un bilanciatore servirebbe un
dedup condiviso (Redis/DB) — vedi i commenti in
[`lib/audit/index.ts`](../lib/audit/index.ts).

---

## Cosa viene tracciato

Gli eventi di **Better Auth** sono mappati centralmente in
[`lib/audit/auth-hooks.ts`](../lib/audit/auth-hooks.ts) da un unico `hooks.after`
(registrato in [`lib/auth.ts`](../lib/auth.ts)):

- **Autenticazione**: login riuscito **e fallito**, logout.
- **Account self-service**: cambio password, cambio email, 2FA on/off,
  eliminazione account.
- **Gestione utenti (admin)**: creazione, eliminazione, ban/unban, cambio ruolo,
  impersonation.

Gli eventi di **dominio** sono registrati con chiamate dirette nei route
handler. Esempi nel repo: reset 2FA
([`reset-2fa/route.ts`](<../app/api/admin/users/[id]/reset-2fa/route.ts>)),
modifica impostazioni e config email
([`settings/route.ts`](../app/api/admin/settings/route.ts),
[`settings/email/route.ts`](../app/api/admin/settings/email/route.ts)).

> Per gli eventi di Better Auth tracciamo i **fallimenti** solo per il login (è
> il segnale di sicurezza che conta); per gli altri, solo i successi, per non
> generare rumore. È una scelta modificabile in `auth-hooks.ts`.

---

## Estendere: aggiungere un evento da tracciare

### 1. Registra l'evento nel catalogo

In [`lib/audit/catalog.ts`](../lib/audit/catalog.ts) aggiungi una voce, con una
`action` nello schema `categoria.soggetto.verbo` e una `label` in italiano:

```ts
{ action: "billing.invoice.paid", category: "billing", label: "Fattura pagata" },
```

La categoria nuova compare automaticamente nei filtri e nei toggle di
configurazione (se vuoi un'etichetta in italiano, aggiungila a
`CATEGORY_LABELS`; altrimenti finisce nel gruppo «Altro»).

### 2. Registra l'evento dove accade

**Evento di dominio** (un tuo route handler / service): chiama `audit()`.

```ts
import { audit } from "@/lib/audit"

await audit({
  action: "billing.invoice.paid",
  actorId: session.user.id,
  actorEmail: session.user.email,
  target: { type: "invoice", id: invoice.id, label: invoice.number },
  metadata: { amount: invoice.amount }, // mai segreti
  request, // per IP / user-agent / request-id
})
```

`audit()` è **fail-open** (non lancia mai) e rispetta la configurazione admin e
il dedup: puoi chiamarlo senza `try/catch` e senza controllare se il logging è
attivo.

**Evento di Better Auth** (un endpoint del framework): aggiungi un `case` nel
`switch` di [`lib/audit/auth-hooks.ts`](../lib/audit/auth-hooks.ts) con il `path`
dell'endpoint e l'`action` corrispondente.

### Regola d'oro

**Mai loggare segreti.** Niente password, token, codici OTP/2FA o contenuti
sensibili in `metadata`/`target`. Logga il fatto e i riferimenti, non i valori.

---

## Lettura e permessi

- Consultare il registro richiede il permesso **`audit.read`**; configurarlo
  richiede **`audit.configure`**. Entrambi sono assegnati al ruolo `admin` (vedi
  [`lib/permissions.ts`](../lib/permissions.ts) e
  [autenticazione e ruoli](autenticazione-e-ruoli.md)).
- Non esiste un permesso di **scrittura**: la scrittura non è un'azione utente,
  avviene server-side.
- Il viewer (`/admin/audit`) offre filtri per categoria, evento, esito, attore e
  intervallo di date, con paginazione.

---

## Retention (pruning)

L'handler [`audit-prune`](../lib/jobs/handlers/audit-prune.ts) elimina le righe
più vecchie di `retentionDays`. È schedulato ogni giorno alle 03:30 in
[`worker.ts`](../worker.ts) e compare tra le operazioni in
`/admin/jobs` (puoi anche eseguirlo a mano da lì). È l'**unico** punto che
cancella audit log, ed è un'operazione di **sistema**, non un'azione applicativa
che possa «ripulire le tracce». Vedi
[operazioni in background](operazioni-in-background.md).
